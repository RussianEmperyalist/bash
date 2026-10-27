/**
 * Реализация команд bash и основных утилит Linux.
 * Каждая команда: function(args, stdin) => string[] | { lines, code }
 * args — уже развернутые аргументы, stdin — строки из предыдущего этапа конвейера.
 * Команда возвращает массив строк (stdout) и, опционально, код завершения.
 */

import { readFile, resolvePath, listDirectory, pathToString, findKey, getNode } from '../simulator/filesystem.js';
import { getUmask, setUmask } from '../simulator/policies.js';

const HOME = '/home/student';
const USER = 'student';
const HOSTNAME = 'linux-student';

let _procs, _svcs, _users, _events, _net, _fsRoot, _cwd;

export function initCommands(procs, svcs, users, events, net, fsRoot, cwd) {
  _procs = procs; _svcs = svcs; _users = users; _events = events;
  _net = net; _fsRoot = fsRoot; _cwd = cwd;
}

function expandTilde(p) {
  if (p === '~') return HOME;
  if (p === undefined) return '.';
  if (p.startsWith('~/')) return HOME + p.slice(1);
  return p;
}

function parseShortFlags(arg) {
  const flags = new Set();
  if (arg.startsWith('-') && arg.length > 1 && !/^-?\d+$/.test(arg)) {
    for (let i = 1; i < arg.length; i++) flags.add(arg[i]);
  }
  return flags;
}

const HELP = {
  ls: ['ls [ОПЦИИ] [ФАЙЛЫ]', 'Выводит содержимое каталогов.', '  -l  Подробный список', '  -a  Скрытые файлы', '  -la Оба варианта', '  -R  Рекурсивно', '  -h  Размеры в человеческом виде'],
  cat: ['cat [ФАЙЛЫ]', 'Выводит содержимое файлов.', '  -n  Нумерация строк'],
  grep: ['grep [ОПЦИИ] ШАБЛОН [ФАЙЛЫ]', 'Ищет строки по шаблону.', '  -i  Без учёта регистра', '  -r  Рекурсивно', '  -n  Номер строки', '  -v  Инвертировать', '  -c  Количество совпадений', '  -l  Только имена файлов', '  -w  Целые слова', '  -E  Расширенные regex'],
  find: ['find [ПУТЬ] [УСЛОВИЯ]', 'Поиск файлов.', '  -name ШАБЛОН  По имени', '  -type f|d  По типу', '  -maxdepth N  Глубина'],
  ps: ['ps [ОПЦИИ]', 'Показывает процессы.', '  aux  Все процессы', '  -p PID  По идентификатору'],
  kill: ['kill [СИГНАЛ] PID', 'Отправляет сигнал процессу.', '  -9  SIGKILL (принудительно)'],
  wc: ['wc [ОПЦИИ] [ФАЙЛЫ]', 'Считает строки, слова, байты.', '  -l  Строки', '  -w  Слова', '  -c  Байты'],
  man: ['man КОМАНДА', 'Просмотр справки о команде.'],
  sha256sum: ['sha256sum ФАЙЛ', 'Хэш SHA-256 файла.'],
  md5sum: ['md5sum ФАЙЛ', 'Хэш MD5 файла.'],
  ss: ['ss [ОПЦИИ]', 'Сетевые соединения.', '  -t  TCP', '  -l  Прослушивание', '  -p  Процессы'],
  id: ['id [ПОЛЬЗОВАТЕЛЬ]', 'Информация о пользователе.'],
  systemctl: ['systemctl status|start|stop UNIT', 'Управление службами.'],
  journalctl: ['journalctl [ОПЦИИ]', 'Просмотр журнала событий.'],
  date: ['date', 'Показывает дату и время.'],
  uname: ['uname [-a]', 'Информация о системе.'],
  df: ['df [-h]', 'Использование диска.'],
  free: ['free [-h]', 'Использование памяти.'],
  chmod: ['chmod РЕЖИМ ФАЙЛ', 'Меняет права доступа.'],
  clear: ['clear', 'Очищает экран.'],
  true: ['true', 'Всегда успех (код 0).'],
  false: ['false', 'Всегда неудача (код 1).']
};

function showHelp(cmd) {
  const key = cmd.toLowerCase().replace(/^-/, '');
  const h = HELP[key] || HELP[cmd.toLowerCase()];
  if (!h) throw new Error(`man: нет справки о '${cmd}'`);
  return h;
}

let _cmds = null;

export function getCommands() {
  if (_cmds) return _cmds;
  _cmds = {
    echo: (args) => {
      let text = '';
      let i = 0, nFlag = true;
      while (i < args.length && nFlag && args[i].startsWith('-') && args[i].length > 1) {
        const f = args[i].slice(1);
        for (const c of f) {
          if (c === 'n') { /* no newline */ }
          else if (c === 'e') { /* escape */ }
          else if (c === 'E') { nFlag = false; }
          else { nFlag = false; }
        }
        i++;
      }
      text = args.slice(i).join(' ');
      return [text];
    },

    pwd: () => [pathToString(_cwd)],

    cd: (args) => {
      let target = args[0];
      if (!target || target === '~') target = HOME;
      else if (target.startsWith('~/')) target = HOME + target.slice(1);
      const r = resolvePath(_fsRoot, _cwd, target);
      if (!r.node || !r.node.c) throw new Error(`cd: ${target}: Нет такого файла или каталога`);
      _cwd.length = 0;
      r.segments.forEach(s => _cwd.push(s));
      return [];
    },

    ls: (args) => {
      const flags = new Set();
      const rest = [];
      for (const a of args) {
        if (a.startsWith('-') && !/^-?\d+$/.test(a)) {
          for (let i = 1; i < a.length; i++) flags.add(a[i]);
        } else rest.push(a);
      }
      const target = expandTilde(rest[0] || '.');
      const r = resolvePath(_fsRoot, _cwd, target);
      if (!r.node) throw new Error(`ls: неправильный аргумент: '${target}': Нет такого файла или каталога`);
      if (r.node.f !== undefined && !r.node.c) return [r.name];
      const entries = listDirectory(r.node, r.segments, flags.has('R'));
      if (flags.has('l')) {
        return entries.map(e => `${e.mode} ${String(e.size).padStart(6)} ${e.name}${e.isDir ? '/' : ''}`);
      }
      if (flags.has('1')) return entries.map(e => e.name + (e.isDir ? '/' : ''));
      const cols = entries.map(e => e.name + (e.isDir ? '/' : ''));
      return cols.length ? [cols.join('  ')] : [];
    },

    cat: (args, stdin) => {
      let data = stdin || [];
      const showNum = args.includes('-n');
      const rest = args.filter(a => a !== '-n');
      if (rest.length === 0) return data;
      let out = [];
      for (const f of rest) {
        const content = readFile(_fsRoot, _cwd, expandTilde(f));
        let lines = content.split('\n').filter((l, i, arr) => l || i < arr.length - 1);
        if (showNum) lines = lines.map((l, i) => `${String(i + 1).padStart(6)}\t${l}`);
        out.push(...lines);
      }
      return out;
    },

    touch: (args) => {
      for (const f of args) {
        const r = resolvePath(_fsRoot, _cwd, expandTilde(f));
        if (r.node && r.node.c) throw new Error(`touch: '${f}': Это каталог`);
        if (!r.node) {
          if (!r.parent || !r.parent.c) throw new Error(`touch: невозможно создать '${f}': Каталог не найден`);
          r.parent.c[findKey(r.parent, r.name) || r.name] = { f: '' };
        }
      }
      return [];
    },

    mkdir: (args) => {
      for (const f of args) {
        const r = resolvePath(_fsRoot, _cwd, expandTilde(f));
        if (r.node) throw new Error(`mkdir: '${f}': Уже существует`);
        if (!r.parent || !r.parent.c) throw new Error(`mkdir: '${f}': Нет такого каталога`);
        r.parent.c[findKey(r.parent, r.name) || r.name] = { c: {} };
      }
      return [];
    },

    rmdir: (args) => {
      const p = args[0];
      const r = resolvePath(_fsRoot, _cwd, expandTilde(p));
      if (!r.node) throw new Error(`rmdir: '${p}': Нет такого каталога`);
      if (!r.node.c) throw new Error(`rmdir: '${p}': Это файл`);
      if (Object.keys(r.node.c).length > 0) throw new Error(`rmdir: '${p}': Каталог не пуст`);
      delete r.parent.c[findKey(r.parent, r.name)];
      return [];
    },

    rm: (args) => {
      const flags = new Set();
      const rest = [];
      for (const a of args) {
        if (a.startsWith('-') && a.length > 1) { for (let i = 1; i < a.length; i++) flags.add(a[i]); }
        else rest.push(a);
      }
      for (const f of rest) {
        const r = resolvePath(_fsRoot, _cwd, expandTilde(f));
        if (!r.node) throw new Error(`rm: '${f}': Нет такого файла`);
        if (r.node.c && Object.keys(r.node.c).length > 0 && !flags.has('f') && !flags.has('r')) {
          throw new Error(`rm: '${f}': Это непустой каталог (используйте -r)`);
        }
        delete r.parent.c[findKey(r.parent, r.name)];
      }
      return [];
    },

    cp: (args) => {
      const rest = args.filter(a => !a.startsWith('-'));
      const src = expandTilde(rest[0]), dst = expandTilde(rest[1]);
      if (!src || !dst) throw new Error('cp: не указаны источник и назначение');
      const r = resolvePath(_fsRoot, _cwd, src);
      if (!r.node || r.node.c) throw new Error(`cp: '${rest[0]}': Нет такого файла`);
      const dr = resolvePath(_fsRoot, _cwd, dst);
      if (dr.node && dr.node.c) dr.node.c[r.name] = { f: r.node.f };
      else if (dr.parent && dr.parent.c) dr.parent.c[findKey(dr.parent, dr.name) || dr.name] = { f: r.node.f };
      return [];
    },

    mv: (args) => {
      const rest = args.filter(a => !a.startsWith('-'));
      const src = expandTilde(rest[0]), dst = expandTilde(rest[1]);
      const r = resolvePath(_fsRoot, _cwd, src);
      if (!r.node) throw new Error(`mv: '${rest[0]}': Нет такого файла`);
      const dr = resolvePath(_fsRoot, _cwd, dst);
      if (dr.node && dr.node.c) dr.node.c[rest[1] || r.name] = r.node;
      else if (dr.parent && dr.parent.c) dr.parent.c[findKey(dr.parent, dr.name)] = r.node;
      if (r.parent && r.parent.c) delete r.parent.c[findKey(r.parent, r.name)];
      return [];
    },

    grep: (args, stdin) => {
      const flags = new Set();
      let pattern = null;
      const files = [];
      let i = 0;
      while (i < args.length) {
        const a = args[i];
        if (a.startsWith('-') && a.length > 1 && !pattern) {
          for (let k = 1; k < a.length; k++) flags.add(a[k]);
        } else {
          if (pattern === null) pattern = a;
          else files.push(a);
        }
        i++;
      }
      if (!pattern) return [];
      let reRaw = pattern;
      let isFixed = flags.has('F');
      if (isFixed) reRaw = reRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (flags.has('w')) reRaw = '\\b' + reRaw + '\\b';
      let re;
      try { re = new RegExp(reRaw, flags.has('i') ? 'i' : ''); } catch (e) { throw new Error('grep: неверный шаблон'); }
      const invert = flags.has('v');
      const recurse = flags.has('r') || flags.has('R');

      const checkLine = (s) => { const hit = re.test(s); return invert ? !hit : hit; };

      if (recurse && files.length) {
        const out = [];
        for (const f of files) {
          const r = resolvePath(_fsRoot, _cwd, expandTilde(f));
          if (!r.node) throw new Error(`grep: ${f}: Нет такого файла или каталога`);
          walkFiles(r.node, r.segments, (segPath) => {
            const node = getNode(_fsRoot, segPath);
            if (!node || node.c) return;
            let content;
            try { content = readFile(_fsRoot, _cwd, pathToString(segPath)); } catch { return; }
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
              if (checkLine(line)) {
                if (flags.has('l')) out.push(pathToString(segPath));
                else if (flags.has('c')) { /* count per file handled below */ }
                else out.push(`${flags.has('n') ? (idx + 1) + ':' : ''}${line}`);
              }
            });
          });
        }
        if (flags.has('l')) return [...new Set(out)];
        return { lines: out, code: out.length ? 0 : 1 };
      }

      const gather = () => {
        const out = [];
        if (files.length) {
          for (const f of files) {
            let lines;
            try { lines = readFile(_fsRoot, _cwd, expandTilde(f)).split('\n'); } catch (e) { throw e; }
            lines.forEach((line, idx) => {
              if (checkLine(line)) out.push(`${flags.has('n') ? (idx + 1) + ':' : ''}${line}`);
            });
          }
        } else {
          (stdin || []).forEach(line => { if (checkLine(line)) out.push(line); });
        }
        return out;
      };

      const matched = gather();
      if (flags.has('c')) {
        if (files.length) {
          return files.map(f => {
            let lines;
            try { lines = readFile(_fsRoot, _cwd, expandTilde(f)).split('\n'); } catch { return '0'; }
            const cnt = lines.filter(checkLine).length;
            return `${cnt}`;
          });
        }
        return [String(matched.length)];
      }
      if (flags.has('l')) return files.filter(f => { let l; try { l = readFile(_fsRoot, _cwd, expandTilde(f)); } catch { return false; } return l.split('\n').some(checkLine); });
      return { lines: matched, code: matched.length ? 0 : 1 };
    },

    find: (args) => {
      let path = '.';
      let name = null, type = null, maxDepth = Infinity;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-name') name = args[++i];
        else if (args[i] === '-type') type = args[++i];
        else if (args[i] === '-maxdepth') maxDepth = Number(args[++i]);
        else if (!args[i].startsWith('-')) path = args[i];
      }
      const r = resolvePath(_fsRoot, _cwd, expandTilde(path));
      if (!r.node || !r.node.c) return [];
      const out = [];
      function walk(node, segs, depth) {
        if (depth > maxDepth) return;
        if (node.c) {
          for (const k of Object.keys(node.c)) {
            const child = node.c[k];
            const p = [...segs, k];
            const ps = pathToString(p);
            let match = true;
            if (name && !matchGlob(k, name)) match = false;
            if (type === 'f' && child.c) match = false;
            if (type === 'd' && !child.c) match = false;
            if (match) out.push(ps);
            if (child.c) walk(child, p, depth + 1);
          }
        }
      }
      walk(r.node, r.segments, 0);
      return out;
    },

    ps: (args) => {
      let procs = _procs;
      const rest = args.filter(a => !a.startsWith('-'));
      if (args.includes('aux') || args.includes('ax')) {
        return procs.map(p => `${String(p.PID).padStart(6)} ${p.User.padEnd(8)} ${String(p.CPU).padStart(5)} ${String(p.MEM).padStart(5)} ${p.Command}`);
      }
      if (rest[0] === '-p') {
        const pid = Number(rest[1]);
        procs = _procs.filter(p => p.PID === pid);
      } else if (rest[0] === '-C') {
        procs = _procs.filter(p => p.Name.toLowerCase() === rest[1].toLowerCase());
      }
      return procs.map(p => `${String(p.PID).padStart(7)}  ${p.User.padEnd(10)}  ${String(p.CPU).padStart(5)}  ${p.Command}`);
    },

    kill: (args) => {
      const flags = new Set();
      const pids = [];
      for (const a of args) {
        if (a.startsWith('-') && a.length > 1) { for (let i = 1; i < a.length; i++) flags.add(a[i]); }
        else pids.push(Number(a));
      }
      for (const pid of pids) {
        const idx = _procs.findIndex(p => p.PID === pid);
        if (idx >= 0) {
          if (flags.has('9')) _procs.splice(idx, 1);
          else _procs[idx].Command = _procs[idx].Command + ' (zombie)';
        } else throw new Error(`kill: (${pid}) — нет такого процесса`);
      }
      return [];
    },

    date: () => [new Date().toLocaleString('ru-RU')],

    uname: (args) => {
      if (args.includes('-a') || args.includes('-s')) return ['Linux linux-student 6.1.0-generic #1 SMP Debian GNU/Linux'];
      return ['Linux'];
    },

    id: (args) => {
      const name = args[0] || USER;
      const u = _users.find(x => x.Name.toLowerCase() === name.toLowerCase());
      if (!u) throw new Error(`id: '${name}': такого пользователя нет`);
      return [`uid=${u.UID}(${u.Name}) gid=${u.GID}(${u.Name}) группы=${u.GID}`];
    },

    whoami: () => [USER],

    groups: (args) => {
      const name = args[0] || USER;
      const u = _users.find(x => x.Name.toLowerCase() === name.toLowerCase());
      if (!u) return [`${name}: * неизвестная учётная запись *`];
      return [`student : student adm sudo dip`];
    },

    systemctl: (args) => {
      const sub = args[0];
      if (sub === 'status' || sub === 'start' || sub === 'stop' || sub === 'restart') {
        const name = args[1];
        const svc = _svcs.find(s => s.Name.toLowerCase() === String(name).toLowerCase());
        if (!svc) throw new Error(`systemctl: Не удалось найти юнит: ${name}`);
        if (sub === 'start') svc.Status = 'active (running)';
        if (sub === 'stop') svc.Status = 'inactive (dead)';
        return [`${svc.Status}`];
      }
      return _svcs.map(s => `${s.Status.padEnd(22)} ${s.Name}`);
    },

    journalctl: (args) => {
      let n = _events.length;
      let level = null;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-n') n = Number(args[i + 1]);
        else if (args[i] === '-p') level = args[i + 1];
      }
      let evs = _events.slice(0, n);
      if (level) evs = evs.filter(e => e.Level.toLowerCase() === String(level).toLowerCase());
      return evs.map(e => `${e.Time} ${e.Level.padEnd(8)} ${e.Source.padEnd(12)} ${e.Message}`);
    },

    ss: (args) => {
      return _net.map(c => `${c.State.padEnd(12)} ${String(c.LocalAddress).padEnd(16)} ${String(c.LocalPort).padStart(6)} ${String(c.RemoteAddress).padEnd(16)} ${String(c.RemotePort).padStart(6)} users:(("pid",pid=${c.PID}))`);
    },

    netstat: (args) => _cmds.ss(args),

    ip: (args) => {
      if (args[0] === 'addr' || args[0] === 'a' || !args.length) {
        return ['', '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN', '    inet 127.0.0.1/8', '2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500', '    inet 192.168.1.15/24', '    inet6 fe80::1/64'];
      }
      return ['Linux ip'];
    },

    sha256sum: (args) => {
      const text = readFile(_fsRoot, _cwd, expandTilde(args[0]));
      return [hashHex(text, 64) + '  ' + args[0]];
    },

    md5sum: (args) => {
      const text = readFile(_fsRoot, _cwd, expandTilde(args[0]));
      return [hashHex(text, 32) + '  ' + args[0]];
    },

    diff: (args) => {
      const a = readFile(_fsRoot, _cwd, expandTilde(args[0])).split('\n');
      const b = readFile(_fsRoot, _cwd, expandTilde(args[1])).split('\n');
      const out = [];
      const n = Math.max(a.length, b.length);
      for (let i = 0; i < n; i++) {
        if (a[i] !== b[i]) { out.push(`< ${a[i] || ''}`); out.push(`> ${b[i] || ''}`); }
      }
      return { lines: out, code: out.length ? 1 : 0 };
    },

    cmp: () => [],

    chmod: (args) => {
      const rest = args.filter(a => !a.startsWith('-'));
      const r = resolvePath(_fsRoot, _cwd, expandTilde(rest[1] || rest[0]));
      if (!r.node) throw new Error(`chmod: '${rest[1] || rest[0]}': Нет такого файла`);
      return [];
    },

    chown: (args) => [],

    df: (args) => {
      return ['Файловая система   Размер  Исп  Дост  Исп% Монтировано на', '/dev/sda1        50G   30G   20G   60% /', 'tmpfs            4M     0   4M    0% /run'];
    },

    free: (args) => {
      return ['              всего        использовано        свободно', 'Память:    8004384      3200128      4804256', 'Подкачка:  2097148           0      2097148'];
    },

    du: (args) => {
      const rest = args.filter(a => !a.startsWith('-'));
      const p = expandTilde(rest[0] || '.');
      return [`4.0K\t${p}`];
    },

    uptime: () => [' 10:23:01 up 3 days,  5:12,  1 user,  load average: 0.15, 0.10, 0.05'],

    top: () => {
      return ['top - 10:23:01 up 3 days,  1 user,  load average: 0.15, 0.10, 0.05', ..._procs.slice(0, 5).map(p => `${String(p.PID).padStart(7)} ${p.User.padEnd(10)} ${String(p.CPU).padStart(5)}  ${p.Command}`), ' tasks:  8 total, 1 running, 7 sleeping'];
    },

    which: (args) => {
      return args.filter(a => !a.startsWith('-')).map(c => {
        const table = _cmds || {};
        if (table[c.toLowerCase()]) return `/usr/bin/${c}`;
        return `${c} не найден`;
      });
    },

    type: (args) => {
      return args.filter(a => !a.startsWith('-')).map(c => {
        if ((_cmds || {})[c.toLowerCase()]) return `${c} — встроенная команда`;
        return `${c} — /usr/bin/${c}`;
      });
    },

    umask: (args) => {
      const rest = args.filter(a => !a.startsWith('-'));
      if (rest[0]) { setUmask(rest[0]); return []; }
      return [getUmask()];
    },

    sort: (args, stdin) => {
      const flags = new Set();
      const rest = [];
      for (const a of args) { if (a.startsWith('-') && a.length > 1) { for (let i = 1; i < a.length; i++) flags.add(a[i]); } else rest.push(a); }
      let data = rest.length ? readFile(_fsRoot, _cwd, expandTilde(rest[0])).split('\n') : (stdin || []);
      const dir = flags.has('r') ? -1 : 1;
      return [...data].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0) * dir);
    },

    uniq: (args, stdin) => {
      const flags = new Set();
      const rest = [];
      for (const a of args) { if (a.startsWith('-') && a.length > 1) { for (let i = 1; i < a.length; i++) flags.add(a[i]); } else rest.push(a); }
      let data = rest.length ? readFile(_fsRoot, _cwd, expandTilde(rest[0])).split('\n') : (stdin || []);
      const out = [];
      for (const line of data) {
        const prev = out[out.length - 1];
        if (prev !== line || !flags.has('c')) out.push(line);
      }
      if (flags.has('c')) return data.map((l, i) => {
        const cnt = 1; return `${cnt} ${l}`;
      });
      return out;
    },

    head: (args, stdin) => {
      const rest = args.filter(a => !a.startsWith('-'));
      const n = rest[0] === '-n' ? Number(rest[1]) : (rest[0] && rest[0].startsWith('-') ? Number(rest[0].slice(1)) : 10);
      let data = stdin || [];
      const fileArg = args.find(a => !a.startsWith('-') && !/^-?\d+$/.test(a));
      if (fileArg) data = readFile(_fsRoot, _cwd, expandTilde(fileArg)).split('\n');
      return data.slice(0, n);
    },

    tail: (args, stdin) => {
      const rest = args.filter(a => !a.startsWith('-'));
      let n = 10;
      if (rest[0] === '-n') n = Number(rest[1]);
      let data = stdin || [];
      const fileArg = args.find(a => !a.startsWith('-') && !/^-?\d+$/.test(a));
      if (fileArg) data = readFile(_fsRoot, _cwd, expandTilde(fileArg)).split('\n');
      return data.slice(-n);
    },

    cut: (args) => {
      const rest = args.filter(a => !a.startsWith('-'));
      const f = rest[0];
      const lines = f ? readFile(_fsRoot, _cwd, expandTilde(f)).split('\n') : [];
      return lines.map(l => l.split(/\s+/)[0] || '');
    },

    tr: (args, stdin) => {
      const a = args[0] || '', b = args[1] || '';
      const data = stdin || [];
      return data.map(l => l.split('').map(ch => {
        const ai = a.indexOf(ch);
        return ai >= 0 && ai < b.length ? b[ai] : ch;
      }).join(''));
    },

    wc: (args, stdin) => {
      const flags = new Set();
      const rest = [];
      for (const a of args) { if (a.startsWith('-') && a.length > 1) { for (let i = 1; i < a.length; i++) flags.add(a[i]); } else rest.push(a); }
      let data = stdin || [];
      if (rest.length) data = readFile(_fsRoot, _cwd, expandTilde(rest[0])).split('\n');
      const l = data.length;
      const wc = data.join('').length;
      if (flags.has('l')) return [`${String(l).padStart(7)}`];
      if (flags.has('c')) return [`${String(wc).padStart(7)}`];
      return [`${String(l).padStart(7)} ${String(wc).padStart(7)}`];
    },

    true: () => ({ lines: [], code: 0 }),
    false: () => ({ lines: [], code: 1 }),

    test: (args) => ({ lines: [], code: runTest(args) ? 0 : 1 }),
    '[': (args) => {
      if (args[args.length - 1] === ']') args.pop();
      return { lines: [], code: runTest(args) ? 0 : 1 };
    },

    man: (args) => showHelp(args[0] || 'man'),

    clear: () => ['\x1b[2J\x1b[H'],

    export: () => [],
    set: () => [],
    'source': () => [],
    '.': () => [],
    printf: (args) => {
      const fmt = args[0] || '';
      return [fmt.replace(/%s/g, ' ').replace(/%d/g, '0')];
    },
    basename: (args) => {
      const parts = (args[0] || '').split('/');
      return [parts[parts.length - 1] || ''];
    },
    dirname: (args) => {
      const parts = (args[0] || '').split('/');
      parts.pop();
      return [parts.join('/') || '/'];
    }
  };
  return _cmds;
}

function runTest(args) {
  if (args.length === 0) return false;
  if (args[0] === '!') return !runTest(args.slice(1));

  const unary = ['z','n','d','f','e','r','w','x','s','u','g','O','G','L'];
  if (args.length === 2 && args[0].startsWith('-') && unary.includes(args[0].slice(1))) {
    const op = args[0].slice(1);
    const val = args[1];
    switch (op) {
      case 'z': return val === '';
      case 'n': return val !== '';
      case 'e': case 'f': case 'd': case 'r': case 'w': case 'x': case 's':
        try {
          const r = resolvePath(_fsRoot, _cwd, expandTilde(val));
          const exists = !!r.node;
          if (!exists) return false;
          if (op === 'd') return !!r.node.c;
          if (op === 'f') return !r.node.c;
          return true;
        } catch { return false; }
    }
    return false;
  }

  if (args.length === 3) {
    const [a, op, b] = args;
    switch (op) {
      case '=': case '==': return a === b;
      case '!=': return a !== b;
      case '<': return a < b;
      case '>': return a > b;
      case '-eq': return Number(a) === Number(b);
      case '-ne': return Number(a) !== Number(b);
      case '-lt': return Number(a) < Number(b);
      case '-le': return Number(a) <= Number(b);
      case '-gt': return Number(a) > Number(b);
      case '-ge': return Number(a) >= Number(b);
    }
  }
  return !!args[0];
}

function matchGlob(name, pattern) {
  if (!pattern) return true;
  const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
  return re.test(name);
}

function walkFiles(node, segs, visit) {
  if (!node.c) return;
  for (const k of Object.keys(node.c)) {
    const child = node.c[k];
    const p = [...segs, k];
    if (child.c) walkFiles(child, p, visit);
    else visit(p);
  }
}

function hashHex(text, hexLen) {
  let h = 2166136265;
  for (let k = 0; k < hexLen / 4; k++) {
    let h2 = h;
    for (const ch of '' + text + '.' + k) h2 = Math.imul(h2 ^ ch.charCodeAt(0), 16777619);
    h = h2 >>> 0;
  }
  let out = (h >>> 0).toString(16);
  while (out.length < hexLen) out = '0' + out;
  return out.slice(-hexLen);
}
