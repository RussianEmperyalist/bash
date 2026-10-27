/**
 * Парсер bash-команд.
 * Разбивает строку на токены: слова и операторы (| ; && || > >> <).
 * Учитывает одинарные и двойные кавычки, $(...) `backticks` и (...).
 * Скобки [ ] { } НЕ участвуют в группировке — они отдельные токены.
 *
 * Пример:
 *   echo "hello $name" | wc -l
 *   → ['echo', '"hello $name"', 'pipe', 'wc', '-l']
 */

const OPS = new Set('|&;><');

/** Разбить строку на токены. */
export function tokenize(str) {
  const tokens = [];
  let i = 0;
  const n = str.length;

  while (i < n) {
    const ch = str[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '#') break;

    if (OPS.has(ch)) {
      const two = str.slice(i, i + 2);
      if (two === '&&') { tokens.push({ op: 'and' }); i += 2; continue; }
      if (two === '||') { tokens.push({ op: 'or' }); i += 2; continue; }
      if (two === '>>') { tokens.push({ op: 'append' }); i += 2; continue; }
      if (two === '<<') { tokens.push({ op: 'heredoc' }); i += 2; continue; }
      if (ch === '>') { tokens.push({ op: 'gt' }); i++; continue; }
      if (ch === '<') { tokens.push({ op: 'lt' }); i++; continue; }
      if (ch === '|') { tokens.push({ op: 'pipe' }); i++; continue; }
      if (ch === ';') { tokens.push({ op: 'semi' }); i++; continue; }
      if (ch === '&') { tokens.push({ op: 'bg' }); i++; continue; }
    }

    const w = readWord(str, i);
    tokens.push(w.value);
    i = w.end;
  }
  return tokens;
}

function readWord(str, start) {
  let i = start;
  const n = str.length;
  let word = '';
  let pd = 0;
  let quote = '';
  while (i < n) {
    const ch = str[i];
    if (quote) {
      word += ch;
      if (ch === quote) quote = '';
      i++; continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; word += ch; i++; continue; }
    if (ch === '(') { pd++; word += ch; i++; continue; }
    if (ch === ')') { if (pd > 0) pd--; word += ch; i++; continue; }
    if (pd === 0 && (/\s/.test(ch) || OPS.has(ch))) break;
    if (ch === '\\' && i + 1 < n) { word += ch + str[i + 1]; i += 2; continue; }
    word += ch; i++;
  }
  return { value: word, end: i };
}

export function isOperator(tok) {
  return tok !== null && typeof tok === 'object';
}

export function isOp(tok, op) {
  return isOperator(tok) && tok.op === op;
}
