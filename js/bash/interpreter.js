/**
 * Главный интерпретатор bash.
 * Точка входа: run(line) → { lines: string[], code: number }
 *
 * Безопасность: пользовательский ввод НЕ превращается в JavaScript.
 * Все команды проходят через tokenize → expand → commands → виртуальную среду.
 */

import { tokenize, isOp } from './parser.js';
import { resolveAlias } from './aliases.js';
import { getCommands, initCommands } from './commands.js';
import { formatOutput } from './formatter.js';
import { resetPolicies } from '../simulator/policies.js';
import { createFilesystem, resolvePath, pathToString, findKey, getNode, listDirectory, readFile, writeFile as simWriteFile } from '../simulator/filesystem.js';
import { createProcesses } from '../simulator/processes.js';
import { createServices } from '../simulator/services.js';
import { createUsers } from '../simulator/users.js';
import { createEvents } from '../simulator/events-log.js';
import { createNetworkConnections } from '../simulator/network.js';

class ReturnSignal extends Error { constructor(code = 0) { super(); this.code = code; this.isReturn = true; } }

export function createInterpreter(env = {}) {
  const proxyWrap = env.proxyWrap || (() => null);

  const V = Object.create(null);        // переменные (строковые)
  const ARR = {};                       // массивы / ассоциативные
  const FN = {};                        // функции
  let exitCode = 0;
  let strict = false;                   // set -e
  let depth = 0;

  const home = env.home || '/home/student';
  const user = env.user || 'student';
  const hostname = env.hostname || 'linux-student';
  setVar('HOME', home);
  setVar('USER', user);
  setVar('HOSTNAME', hostname);
  setVar('PWD', home);
  setVar('PATH', '/usr/bin:/bin');
  setVar('SHELL', '/bin/bash');
  setVar('IFS', ' \t\n');
  V['0'] = 'bash';

  let cwd = env.cwd;
  let procs = createProcesses();
  let svcs = createServices();
  let users = createUsers();
  let events = createEvents();
  let net = createNetworkConnections();
  let fsRoot = createFilesystem();

  initCommands(procs, svcs, users, events, net, fsRoot, cwd);

  const pid = 4242;

  function resolveVar(name) {
    name = name.toLowerCase();
    if (name === '_') return V._;
    if (name === 'ifs') return V.IFS || ' \t\n';
    if (Object.prototype.hasOwnProperty.call(V, name)) {
      const v = V[name];
      return v === undefined ? '' : String(v);
    }
    return '';
  }

  function setVar(name, value, isArray) {
    name = name.toLowerCase();
    if (isArray) ARR[name] = value;
    else V[name] = String(value === undefined ? '' : value);
  }

  function readName(token, i) {
    let j = i, name = '';
    while (j < token.length && /[A-Za-z0-9_]/.test(token[j])) { name += token[j]; j++; }
    return { name, end: j };
  }

  function findClosing(s, start, open, close) {
    let depth = 1, quote = '', i = start;
    while (i < s.length && depth > 0) {
      const ch = s[i];
      if (quote) { if (ch === quote) quote = ''; i++; continue; }
      if (ch === '"' || ch === "'") { quote = ch; i++; continue; }
      if (ch === '\\') { i += 2; continue; }
      if (ch === open) depth++;
      else if (ch === close) depth--;
      i++;
    }
    return depth === 0 ? i - 1 : -1;
  }

  function runCmdSub(cmd) {
    try {
      const r = execLine(cmd, [], false);
      return (r.lines || []).filter(l => l != null).join('\n');
    } catch { return ''; }
  }

  function expandSpecial(s, i) {
    const ch = s[i + 1];
    if (ch === '?') return { value: String(exitCode), next: i + 2, wasExp: true };
    if (ch === '#') return { value: String(currentArgc()), next: i + 2, wasExp: true };
    if (ch === '0') return { value: V['0'], next: i + 2, wasExp: true };
    if (ch === '@' || ch === '*') return { value: currentArgs().join(' '), next: i + 2, wasExp: true };
    if (ch === '!') return { value: String(pid), next: i + 2, wasExp: true };
    if (ch === '-') return { value: 'himBHsS', next: i + 2, wasExp: true };
    return { value: '', next: i + 2, wasExp: true };
  }

  let _curArgs = [];
  function currentArgs() { return _curArgs; }
  function currentArgc() { return _curArgs.length; }

  function evalArith(expr) {
    expr = expr.replace(/\$([A-Za-z_]\w*)/g, (_, n) => String(Number(resolveVar(n)) || 0));
    expr = expr.replace(/\$(\d)/g, (_, n) => String(_curArgs[Number(n) - 1] != null ? Number(_curArgs[Number(n)-1]) || 0 : 0));
    expr = expr.replace(/\s+/g, '');
    let p = 0;
    const peek = () => expr[p];
    const skipWs = () => { while (p < expr.length && expr[p] === ' ') p++; };
    const number = () => {
      skipWs();
      if (expr[p] === '(') { p++; const v = add(); skipWs(); if (expr[p] === ')') p++; return v; }
      if (expr[p] === '-') { p++; return -number(); }
      const m = expr.slice(p).match(/^\d+/);
      if (m) { p += m[0].length; return Number(m[0]); }
      return 0;
    };
    const mul = () => {
      let v = number();
      while (true) {
        skipWs();
        if (expr[p] === '*') { p++; v *= number(); }
        else if (expr[p] === '/') { p++; v /= number(); }
        else if (expr[p] === '%') { p++; v %= number(); }
        else break;
      }
      return v;
    };
    const add = () => {
      let v = mul();
      while (true) {
        skipWs();
        if (expr[p] === '+') { p++; v += mul(); }
        else if (expr[p] === '-') { p++; v -= mul(); }
        else break;
      }
      return v;
    };
    try { return String(add()); } catch { return '0'; }
  }

  function expandParam(inner) {
    if (inner[0] === '#') {
      const rest = inner.slice(1);
      const mArr = rest.match(/^([A-Za-z_]\w*)\[@?\]$/);
      if (mArr) {
        const arr = ARR[mArr[1].toLowerCase()];
        if (Array.isArray(arr)) return String(arr.length);
        if (arr && typeof arr === 'object') return String(Object.keys(arr).length);
        return '0';
      }
      const mIdx = rest.match(/^([A-Za-z_]\w*)\[\d+\]$/);
      if (mIdx) return String((resolveVar(mIdx[1]) || '').length);
      return String((resolveVar(rest) || '').length);
    }
    if (/^[A-Za-z_]\w*[\?\-\+]=\s*$/.test(inner)) return ''; // ${var:=} handled below
    const mDef = inner.match(/^([A-Za-z_]\w*)([:?+]-=|:=|\?=|\?|:|-|\+)([.\s\S]*)$/);
    if (mDef) {
      const name = mDef[1];
      const op = mDef[2];
      const def = mDef[3];
      const v = V[name.toLowerCase()];
      const isset = Object.prototype.hasOwnProperty.call(V, name) && v !== undefined && v !== '';
      const defVal = expandInternal(def).value;
      switch (op) {
        case ':-': case '-': return isset ? String(v) : defVal;
        case ':=': case '=': if (!isset) { setVar(name, defVal); } return isset ? String(v) : defVal;
        case ':?': case '?': if (!isset) throw new Error(defVal || `${name}: не задана переменная`); return String(v);
        case ':+': case '+': return isset ? defVal : '';
      }
      return String(v);
    }
    const mArr = inner.match(/^([A-Za-z_]\w*)\[@?\]$/);
    if (mArr) {
      const arr = ARR[mArr[1].toLowerCase()];
      if (Array.isArray(arr)) return arr.map(String).join(' ');
      const v = resolveVar(mArr[1]);
      return Array.isArray(v) ? v.map(String).join(' ') : '';
    }
    const mIdx = inner.match(/^([A-Za-z_]\w*)\[(\d+)\]$/);
    if (mIdx) {
      const arr = ARR[mIdx[1].toLowerCase()];
      if (Array.isArray(arr)) return arr[Number(mIdx[2])] != null ? String(arr[Number(mIdx[2])]) : '';
      return '';
    }
    const mKey = inner.match(/^([A-Za-z_]\w*)\[([^\]]*)\]$/);
    if (mKey) {
      const arr = ARR[mKey[1].toLowerCase()];
      if (arr && typeof arr === 'object' && !Array.isArray(arr)) return arr[mKey[2]] != null ? String(arr[mKey[2]]) : '';
      return '';
    }
    const bareName = inner.match(/^([A-Za-z_]\w*)$/);
    if (bareName) return String(resolveVar(bareName[1]));
    return '';
  }

  function expandDollar(token, i) {
    const next = token[i + 1];
    if (next === '(') {
      if (token[i + 2] === '(') {
        const end = findClosing(token, i + 3, '(', ')');
        if (end < 0) return { value: '$', next: i + 1, wasExp: false };
        const skip = token[end + 1] === ')' ? end + 2 : end + 1;
        return { value: evalArith(token.slice(i + 3, end)), next: skip, wasExp: true };
      }
      const end = findClosing(token, i + 2, '(', ')');
      if (end < 0) return { value: '$', next: i + 1, wasExp: false };
      return { value: runCmdSub(token.slice(i + 2, end)), next: end + 1, wasExp: true };
    }
    if (next === '{') {
      const end = findClosing(token, i + 2, '{', '}');
      if (end < 0) return { value: '$', next: i + 1, wasExp: false };
      return { value: expandParam(token.slice(i + 2, end)), next: end + 1, wasExp: true };
    }
    if ('0123456789#?!@*$-'.includes(next)) return expandSpecial(token, i);
    if (/[A-Za-z_]/.test(next)) {
      const r = readName(token, i + 1);
      return { value: resolveVar(r.name), next: r.end, wasExp: true };
    }
    return { value: '$', next: i + 1, wasExp: false };
  }

  function expandInline(token, start, inDouble) {
    let result = '', i = start, n = token.length;
    while (i < n) {
      const ch = token[i];
      if (inDouble && ch === '"') return { value: result, next: i + 1, wasExp: false };
      if (ch === '\\' && i + 1 < n) { result += token[i + 1]; i += 2; continue; }
      if (ch === '$') { const d = expandDollar(token, i); result += d.value; if (d.wasExp) return { value: result, next: d.next, wasExp: true }; i = d.next; continue; }
      if (ch === '`') {
        const end = token.indexOf('`', i + 1);
        if (end < 0) return { value: result, next: i + 1, wasExp: false };
        result += runCmdSub(token.slice(i + 1, end));
        return { value: result, next: end + 1, wasExp: true };
      }
      result += ch; i++;
    }
    return { value: result, next: i, wasExp: false };
  }

  function expandInternal(token) {
    let result = '', unquoted = false, i = 0, n = token.length;
    while (i < n) {
      const ch = token[i];
      if (ch === "'") {
        let j = i + 1;
        while (j < n && token[j] !== "'") { result += token[j]; j++; }
        i = j + 1;
        continue;
      }
      if (ch === '"') {
        let j = i + 1;
        while (j < n && token[j] !== '"') {
          const r = expandInline(token, j, true);
          result += r.value;
          j = r.next;
        }
        i = j + 1;
        continue;
      }
      const r = expandInline(token, i, false);
      result += r.value;
      if (r.wasExp) unquoted = true;
      i = r.next;
    }
    return { value: result, unquoted };
  }

  function expandToken(token) {
    const seg = expandInternal(token);
    if (seg.unquoted) {
      const ifs = V.IFS || ' \t\n';
      const re = new RegExp('[' + ifs.replace(/[\]\}/\\]/g, '\\$&') + ']+');
      return seg.value.split(re).filter(w => w.length > 0);
    }
    return seg.value.length === 0 ? [] : [seg.value];
  }

  function expandRhs(token) { return expandInternal(token).value; }

  function isAssignmentToken(tok) {
    if (typeof tok !== 'string' || tok[0] === '"' || tok[0] === "'") return false;
    return /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?=(.*)$/.test(tok) || /^\w+=\(.*\)$/.test(tok);
  }

  function applyAssignment(assignment) {
    const arrLit = /^([A-Za-z_]\w+)=\(([\s\S]*)\)$/.exec(assignment);
    if (arrLit) {
      const inner = arrLit[2].trim();
      const name = arrLit[1].toLowerCase();
      const existing = ARR[name];
      const isAssoc = existing && typeof existing === 'object' && !Array.isArray(existing);
      if (inner) {
        let elems;
        if (isAssoc) {
          const pairs = {};
          const parts = inner.split(/\s+/);
          for (const part of parts) {
            const m = part.match(/^\[([^\]]*)\]=(.+)$/);
            if (m) { pairs[expandRhs(m[1])] = expandRhs(m[2]); }
            else { pairs[part] = expandRhs(part); }
          }
          ARR[name] = pairs;
        } else {
          elems = inner.split(/\s+/).map(e => expandRhs(e));
          ARR[name] = elems;
        }
      } else {
        ARR[name] = isAssoc ? {} : [];
      }
      return;
    }
    const eq = assignment.indexOf('=');
    const name = assignment.slice(0, eq);
    const val = expandRhs(assignment.slice(eq + 1));
    const mArr = /^([A-Za-z_]\w*)\[([^\]]*)\]$/.exec(name);
    if (mArr) {
      const n = mArr[1].toLowerCase();
      if (!ARR[n] || Array.isArray(ARR[n])) ARR[n] = Array.isArray(ARR[n]) ? ARR[n] : {};
      ARR[n][mArr[2]] = val;
      return;
    }
    setVar(name, val, false);
  }

  function parseRedirections(tokens) {
    const args = [], redirs = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i], nxt = tokens[i + 1];
      if (typeof t === 'string' && /^\d$/.test(t) && nxt && (isOp(nxt, 'gt') || isOp(nxt, 'append') || isOp(nxt, 'lt'))) {
        redirs.push({ fd: Number(t), op: nxt.op, target: tokens[++i] }); continue;
      }
      if (isOp(t, 'gt') && nxt) { redirs.push({ fd: 1, op: 'gt', target: nxt }); i++; continue; }
      if (isOp(t, 'append') && nxt) { redirs.push({ fd: 1, op: 'append', target: nxt }); i++; continue; }
      if (isOp(t, 'lt') && nxt) { redirs.push({ fd: 0, op: 'lt', target: nxt }); i++; continue; }
      args.push(t);
    }
    return { args, redirs };
  }

  function execLine(line, stdin, capturing) {
    if (capturing == null) capturing = false;
    if (++depth > 200) throw new Error('Превышена максимальная глубина вложенности (200). Проверьте рекурсию.');
    try {
      const tokens = typeof line === 'string' ? tokenize(line) : line;
      if (tokens.length === 0) return { lines: [], code: 0 };
      return execTokens(tokens, stdin || [], capturing, false);
    } finally { depth--; }
  }

  function execTokens(tokens, stdin, capturing, noStrict) {
    const first = tokens.find(t => typeof t === 'string');
    if (first && (first === 'if' || first === 'for' || first === 'while' || first === 'until' || first === 'case' || first === 'function' || /^\w+\(\)$/.test(first))) {
      const res = execCommand(tokens, stdin);
      exitCode = res.code;
      return res;
    }
    const segments = splitSegments(tokens);
    let prevCode = 0;
    const out = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const nextOp = i + 1 < segments.length ? segments[i + 1].op : 'end';
      if (seg.op === 'and' && prevCode !== 0) { prevCode = 0; continue; }
      if (seg.op === 'or' && prevCode === 0) { prevCode = 0; continue; }
      let res;
      try {
        res = execPipeline(seg.tokens, stdin);
      } catch (e) {
        if (e && e.suppressStderr) { res = { lines: [], code: 1 }; }
        else if (seg.op === 'or' || nextOp === 'or' || nextOp === 'and' || capturing || nextOp === 'seq' || nextOp === 'end') {
          res = { lines: [], code: 1 };
        } else {
          throw e;
        }
      }
      exitCode = prevCode = res.code;
      out.push(...res.lines);
      if (!noStrict && strict && prevCode !== 0 && nextOp === 'end') {
        throw new Error(`Команда завершилась с кодом ${prevCode}`);
      }
      stdin = [];
    }
    return { lines: out, code: prevCode };
  }

  function splitSegments(tokens) {
    const segs = [];
    let cur = [], curOp = 'seq';
    const push = () => { if (cur.length || segs.length) { segs.push({ op: curOp, tokens: cur }); } cur = []; };
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (typeof t === 'string' && (t === ';' || t === 'then' || t === 'do')) { push(); curOp = 'seq'; continue; }
      if (isOp(t, 'semi')) { push(); curOp = 'seq'; continue; }
      if (isOp(t, 'and')) { push(); curOp = 'and'; continue; }
      if (isOp(t, 'or')) { push(); curOp = 'or'; continue; }
      cur.push(t);
    }
    push();
    return segs;
  }


  function splitByPipe(tokens) {
    const parts = [], cur = [];
    for (const t of tokens) {
      if (isOp(t, 'pipe')) { if (cur.length) { parts.push([...cur]); cur.length = 0; } }
      else cur.push(t);
    }
    if (cur.length) parts.push(cur);
    return parts;
  }

  function execPipeline(tokens, stdin) {
    const stages = splitByPipe(tokens);
    if (stages.length === 0) return { lines: [], code: 0 };
    let input = stdin || [];
    let code = 0;
    for (const st of stages) {
      const res = execCommand(st, input);
      input = res.lines;
      code = res.code;
      exitCode = code;
    }
    return { lines: input, code };
  }


  function execCommand(tokens, stdin) {
    if (tokens.length === 0) return { lines: [], code: 0 };
    const first = tokens[0];
    if (typeof first === 'string') {
      if (first === 'if') return execIf(tokens);
      if (first === 'for') return execFor(tokens);
      if (first === 'while' || first === 'until') return execWhile(tokens, first === 'until');
      if (first === 'case') return execCase(tokens);
      if (first === '{') return execGroup(tokens);
      if (first === 'function' || isFnDef(tokens)) return execFunctionDef(tokens);
      if (/^\w+\(\)$/.test(first)) return execFunctionDef(tokens);
    }
    return execSimple(tokens, stdin);
  }

  function isFnDef(tokens) {
    return tokens.length >= 3 && typeof tokens[0] === 'string' && /^\w+\(\)$/.test(tokens[0]) && tokens[1] === '{';
  }

  function execSimple(tokens, stdin) {
    const { args, redirs } = parseRedirections(tokens);
    if (args.length === 0) return { lines: [], code: 0 };

    const assignments = [];
    let i = 0;
    while (i < args.length && isAssignmentToken(args[i])) { assignments.push(args[i]); i++; }
    const cmdArgs = args.slice(i);

    for (const a of assignments) {
      applyAssignment(a);
    }

    if (cmdArgs.length === 0) return { lines: [], code: 0 };

    const name = cmdArgs[0].toLowerCase();
    if (name === 'set') return execSet(cmdArgs.slice(1));
    if (name === 'unset') return execUnset(cmdArgs.slice(1));
    if (name === 'export') { execExport(cmdArgs.slice(1)); return { lines: [], code: 0 }; }
    if (name === 'declare' || name === 'local' || name === 'readonly') return execDeclare(cmdArgs.slice(1));
    if (name === 'return') {
      const v = cmdArgs.length > 1 ? Number(expandRhs(cmdArgs[1])) : exitCode;
      throw new ReturnSignal(v);
    }
    if (name === 'exit') {
      throw new ExitError(cmdArgs.length > 1 ? Number(cmdArgs[1]) : exitCode, true);
    }

    if (args[0] && (args[0].toLowerCase() === 'man' || cmdArgs.includes('--help'))) {
      const hname = cmdArgs.includes('--help') ? cmdArgs[0] : cmdArgs[1];
      const h = HELP[hname && hname.toLowerCase()];
      if (h) return { lines: h, code: 0 };
    }

    const expanded = cmdArgs.slice(1).flatMap(t => expandToken(t));
    const fn = resolveAlias(name) || name;
    const cmds = getCommands();
    const cmdFn = cmds[fn.toLowerCase()] || cmds[name];
    if (cmdFn) {
      let result;
      try {
        result = cmdFn(expanded, stdin || []);
      } catch (e) {
        if (redirs.some(r => r.fd === 2 && r.target === '/dev/null')) return { lines: [], code: 1 };
        throw e;
      }
      let lines = Array.isArray(result) ? result : (result.lines || []);
      const code = Array.isArray(result) ? 0 : (result.code || 0);
      ({ lines } = applyRedirections(redirs, lines));
      return { lines, code };
    }
    if (FN[name]) {
      const prevArgs = _curArgs;
      _curArgs = expanded;
      try {
        const r = execLine(FN[name].body, stdin || [], false);
        return r;
      } catch (e) {
        if (e instanceof ReturnSignal) return { lines: e.isReturn ? [] : [], code: e.code };
        throw e;
      } finally {
        _curArgs = prevArgs;
      }
    }
    throw new Error(`${name}: команда не найдена`);
  }

  class ExitError extends Error { constructor(code, isExit) { super(); this.code = code; this.isExit = isExit; } }

  function execSet(args) {
    for (const a of args) {
      if (a === '-e') strict = true;
      else if (a === '+e') strict = false;
      else if (a === '-o' && args.includes('pipefail')) pipefail = true;
    }
    return { lines: [], code: 0 };
  }

  let pipefail = false;

  function execUnset(args) {
    for (const a of args) {
      const name = a.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(V, name)) delete V[name];
      if (ARR[name]) delete ARR[name];
    }
    return { lines: [], code: 0 };
  }

  function execExport(args) {
    for (const a of args) {
      if (a.includes('=')) {
        const eq = a.indexOf('=');
        setVar(a.slice(0, eq), expandRhs(a.slice(eq + 1)));
      }
    }
    return { lines: [], code: 0 };
  }

  function execDeclare(args) {
    if (args[0] === '-A') {
      const name = (args[1] || '').toLowerCase();
      ARR[name] = ARR[name] || {};
      return { lines: [], code: 0 };
    }
    if (args[0] === '-a' || args[0] === '-r') {
      const name = (args[1] || '').toLowerCase();
      ARR[name] = ARR[name] || [];
      return { lines: [], code: 0 };
    }
    for (const a of args) {
      if (isAssignmentToken(a)) {
        applyAssignment(a);
      }
    }
    return { lines: [], code: 0 };
  }

  function execGroup(tokens) {
    const inner = tokens.slice(1, tokens.length - 1);
    return execTokens(inner, [], false, false);
  }

  function execFunctionDef(tokens) {
    let name, bodyStart;
    if (tokens[0] === 'function') {
      name = tokens[1]; bodyStart = tokens.indexOf('{');
    } else {
      const m = /^(\w+)\(\)$/.exec(tokens[0]);
      name = m ? m[1] : tokens[0];
      bodyStart = tokens.indexOf('{');
    }
    const bodyEnd = findClosingTok(tokens, bodyStart, '{', '}');
    if (bodyEnd < 0) throw new Error('bash: синтаксическая ошибка: не закрыта }');
    const body = tokens.slice(bodyStart + 1, bodyEnd).filter(t => !(typeof t === 'string' && (t === ';' || t === '}')));
    FN[name.toLowerCase()] = { body: tokensToLine(body) };
    return { lines: [], code: 0 };
  }

  function tokensToLine(tokens) {
    return tokens.map(t => isOp(t) ? (t.op === 'pipe' ? '|' : t.op === 'and' ? '&&' : t.op === 'or' ? '||' : ';') : t).join(' ');
  }

  function execIf(tokens) {
    let i = 1;
    const thenIdx = findKw(tokens, i, 'then');
    let condEnd = thenIdx - 1;
    while (condEnd >= 0 && (tokens[condEnd] === ';' || isOp(tokens[condEnd], 'semi'))) condEnd--;
    const condTokens = tokens.slice(i, condEnd + 1);
    const condRes = execTokens(condTokens, [], false, true);
    if (condRes.code === 0) {
      return execIfBody(tokens, thenIdx + 1, tokens.length);
    }
    return execIfRest(tokens, thenIdx + 1);
  }

  function execIfBody(tokens, start, end) {
    const kw = findKw(tokens, start, 'elif', 'else', 'fi');
    const body = tokens.slice(start, kw - 1).filter(t => !(typeof t === 'string' && (t === ';' || t === 'then')));
    const r = execTokens(body, [], false, false);
    return r;
  }

  function execIfRest(tokens, afterThen) {
    let i = afterThen;
    while (i < tokens.length) {
      const kw = findKw(tokens, i, 'elif', 'else', 'fi');
      if (kw < 0) return { lines: [], code: 0 };
      if (tokens[kw] === 'elif') {
        let condEnd = tokens.indexOf('then', kw + 1) - 1;
        while (condEnd >= 0 && (tokens[condEnd] === ';' || isOp(tokens[condEnd], 'semi'))) condEnd--;
        const condRes = execTokens(tokens.slice(kw + 1, condEnd + 1), [], false, true);
        if (condRes.code === 0) {
          const thenIdx = tokens.indexOf('then', kw + 1);
          return execIfBody(tokens, thenIdx + 1, tokens.length);
        }
        i = thenIdx + 1;
      } else if (tokens[kw] === 'else') {
        const fi = tokens.indexOf('fi', kw + 1);
        const body = tokens.slice(kw + 1, fi - 1).filter(t => !(typeof t === 'string' && (t === ';' || t === 'fi')));
        return execTokens(body, [], false, false);
      } else {
        return { lines: [], code: 0 };
      }
    }
    return { lines: [], code: 0 };
  }

  function execFor(tokens) {
    let i = 1;
    const varName = tokens[i++];
    let list = [];
    if (tokens[i] === 'in') {
      i++;
      while (i < tokens.length && tokens[i] !== 'do') {
        if (!(typeof tokens[i] === 'string' && (tokens[i] === ';' || isOp(tokens[i], 'semi')))) {
          list.push(...expandToken(tokens[i]));
        }
        i++;
      }
    } else {
      list = _curArgs.slice();
    }
    const doIdx = findKw(tokens, i, 'do');
    const doneIdx = findKw(tokens, doIdx + 1, 'done');
    const body = tokens.slice(doIdx + 1, doneIdx);
    let out = [], code = 0;
    for (const item of list) {
      setVar(varName, item, false);
      const r = execTokens(body, [], false, false);
      out.push(...r.lines); code = r.code;
    }
    return { lines: out, code };
  }

  function execWhile(tokens, negate) {
    const doIdx = findKw(tokens, 1, 'do');
    let condEnd = doIdx - 1;
    while (condEnd >= 0 && (tokens[condEnd] === ';' || isOp(tokens[condEnd], 'semi'))) condEnd--;
    const condTokens = tokens.slice(1, condEnd + 1);
    const doneIdx = findKw(doIdx + 1, 'done');
    const body = tokens.slice(doIdx + 1, doneIdx);
    let out = [], code = 0, n = 0;
    while (true) {
      let condRes;
      try { condRes = execTokens(condTokens, [], false, true); } catch { condRes = { code: 1 }; }
      const cont = negate ? condRes.code !== 0 : condRes.code === 0;
      if (!cont) break;
      if (++n > 10000) throw new Error('Превышен лимит итераций while (10000). Проверьте условие.');
      const r = execTokens(body, [], false, false);
      out.push(...r.lines); code = r.code;
    }
    return { lines: out, code };
  }

  function execCase(tokens) {
    let i = 2;
    while (i < tokens.length && tokens[i] !== 'esac') {
      let patEnd = i;
      while (patEnd < tokens.length && tokens[patEnd] !== ')') patEnd++;
      i = patEnd + 1;
      let body = [], j = i;
      while (j < tokens.length) {
        if (isOp(tokens[j], 'semi') && j + 1 < tokens.length && isOp(tokens[j + 1], 'semi')) { j += 2; break; }
        if (tokens[j] === 'esac') { j++; break; }
        body.push(tokens[j]); j++;
      }
      i = j;
      if (body.length) return execTokens(body, [], false, false);
    }
    return { lines: [], code: 0 };
  }

  function findKw(tokens, from, ...kws) {
    for (let i = from; i < tokens.length; i++) {
      const t = tokens[i];
      if (typeof t === 'string' && kws.includes(t)) return i;
    }
    return -1;
  }

  function findClosingTok(tokens, start, open, close) {
    let depth = 1, i = start + 1;
    while (i < tokens.length && depth > 0) {
      const t = tokens[i];
      if (t === open) depth++;
      else if (t === close) depth--;
      i++;
    }
    return depth === 0 ? i - 2 : -1;
  }

  function getHome() { return V.HOME || '/home/student'; }

  function applyRedirections(redirs, lines) {
    let finalLines = lines;
    for (const r of redirs) {
      if (r.op === 'gt' && r.fd === 1) {
        if (r.target !== '/dev/null') simWriteFile(fsRoot, cwd, r.target || '', finalLines.join('\n'));
        finalLines = [];
      }
      if (r.op === 'append' && r.fd === 1) {
        if (r.target !== '/dev/null') simWriteFile(fsRoot, cwd, r.target || '', finalLines.join('\n'), true);
        finalLines = [];
      }
      if (r.op === 'lt' && r.fd === 0) {
        finalLines = readFile(fsRoot, cwd, r.target || '').split('\n');
      }
    }
    return { lines: finalLines };
  }

  const HELP = {
    ls: ['ls [ОПЦИИ] [ФАЙЛЫ]', 'Выводит содержимое каталогов.', '  -l  Подробный список', '  -a  Скрытые', '  -la  Оба варианта', '  -R  Рекурсивно'],
    grep: ['grep [ОПЦИИ] ШАБЛОН [ФАЙЛЫ]', 'Ищет строки по шаблону.', '  -i  Без учёта регистра', '  -r  Рекурсивно', '  -n  Номер строки', '  -v  Инвертировать', '  -c  Количество', '  -l  Только файлы'],
    cat: ['cat [ФАЙЛЫ]', 'Выводит содержимое файлов.', '  -n  Нумерация строк'],
    wc: ['wc [ОПЦИИ] [ФАЙЛЫ]', 'Считает строки, слова, байты.', '  -l  Строки', '  -w  Слова', '  -c  Байты'],
    ps: ['ps [aux|-p PID]', 'Показывает процессы.'],
    man: ['man КОМАНДА', 'Просмотр справки о команде.'],
    sha256sum: ['sha256sum ФАЙЛ', 'Хэш SHA-256 файла.'],
    md5sum: ['md5sum ФАЙЛ', 'Хэш MD5 файла.'],
    find: ['find ПУТЬ -name ШАБЛОН', 'Поиск файлов.'],
    systemctl: ['systemctl status UNIT', 'Управление службами.'],
    journalctl: ['journalctl', 'Просмотр журнала событий.'],
    ss: ['ss -tlnp', 'Сетевые соединения.'],
    id: ['id [ПОЛЬЗОВАТЕЛЬ]', 'Информация о пользователе.'],
    date: ['date', 'Дата и время.'],
    df: ['df [-h]', 'Использование диска.'],
    free: ['free [-h]', 'Использование памяти.'],
    top: ['top', 'Процессы в реальном времени.'],
    kill: ['kill PID', 'Отправка сигнала процессу.'],
    chmod: ['chmod РЕЖИМ ФАЙЛ', 'Права доступа.'],
    clear: ['clear', 'Очистить экран.']
  };

  let _caught = false;
  const api = {
    run(line) {
      _caught = false;
      try {
        const r = execLine(line, [], false);
        exitCode = r.code;
        return { lines: r.lines, code: r.code };
      } catch (e) {
        if (e instanceof ReturnSignal) { exitCode = e.code; return { lines: [], code: e.code }; }
        if (e instanceof ExitError) { exitCode = e.code; return { lines: [], code: e.code }; }
        _caught = true;
        const msg = e instanceof Error ? e.message : String(e);
        exitCode = e.code || 1;
        return { lines: [], code: exitCode, error: msg };
      }
    },
    getLine() { return `${resolveVar('USER') || 'student'}@${resolveVar('HOSTNAME') || 'bash4all'}:${pathToString(cwd)}$ `; },
    getVars() { return V; },
    getArrays() { return ARR; },
    getFns() { return FN; },
    getExitCode() { return exitCode; },
    wasCaught() { return _caught; },
    getInterp: () => api,
    getEnv: () => ({ procs: () => procs, svcs: () => svcs, users: () => users, events: () => events, net: () => net, fsRoot: () => fsRoot, cwd: () => cwd, path: () => pathToString(cwd) }),
    reset() {
      for (const k of Object.keys(V)) delete V[k];
      for (const k of Object.keys(ARR)) delete ARR[k];
      for (const k of Object.keys(FN)) delete FN[k];
      setVar('HOME', home);
      setVar('USER', user);
      setVar('HOSTNAME', hostname);
      setVar('PWD', home);
      setVar('PATH', '/usr/bin:/bin');
      setVar('SHELL', '/bin/bash');
      setVar('IFS', ' \t\n');
      V['0'] = 'bash';
      exitCode = 0; strict = false; pipefail = false; depth = 0; _curArgs = [];
      procs = createProcesses(); svcs = createServices(); users = createUsers();
      events = createEvents(); net = createNetworkConnections(); fsRoot = createFilesystem();
      cwd.length = 0; home.split('/').filter(Boolean).forEach(s => cwd.push(s));
      resetPolicies();
      initCommands(procs, svcs, users, events, net, fsRoot, cwd);
      _cmds = null;
    }
  };

  return api;
}
