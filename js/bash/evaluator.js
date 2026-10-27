/**
 * Вычисление выражений и операторов сравнения для bash.
 * Используется командой test ([ ... ]) и в условиях.
 */

/** Операторы сравнения для test [[ ... ]] / [ ... ] */
export const comparisonOps = {
  like(s, p) {
    const re = new RegExp(
      '^' + String(p).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i'
    );
    return re.test(s);
  },
  notlike(s, p) { return !this.like(s, p); },
  match(s, p) {
    try { return new RegExp(p, 'i').test(s); } catch (e) { return false; }
  },
  notmatch(s, p) { return !this.match(s, p); },
  contains(a, b) { return String(a).includes(String(b)); }
};

/** Преобразовать аргумент в число, если это возможно. */
export function toNum(v) {
  const n = Number(v);
  return isNaN(n) ? v : n;
}

/** Оценить test-выражение: массив аргументов без обёртки [ ]. */
export function evalTest(args) {
  if (args.length === 0) return false;

  const unaryOps = ['z','n','b','d','e','f','r','w','x','s','u','g','O','G','L'];
  if (args.length === 2 && unaryOps.includes(args[0].slice(1))) {
    const op = args[0].slice(1);
    const val = args[1];
    switch (op) {
      case 'z': return val === '';
      case 'n': return val !== '';
      case 'e': return fileExists(val);
      case 'f': return fileExists(val) && !isDir(val);
      case 'd': return isDir(val);
      case 'r': return fileExists(val);
      case 'w': return fileExists(val);
      case 'x': return fileExists(val);
      case 's': return fileExists(val) && String(val).length > 0;
      default: return false;
    }
  }

  if (args.length === 3) {
    const a = args[0], op = args[1], b = args[2];
    switch (op) {
      case '=':
      case '==': return String(a) === String(b);
      case '!=': return String(a) !== String(b);
      case '<': return String(a) < String(b);
      case '>': return String(a) > String(b);
      case '-eq': return toNum(a) === toNum(b);
      case '-ne': return toNum(a) !== toNum(b);
      case '-lt': return toNum(a) < toNum(b);
      case '-le': return toNum(a) <= toNum(b);
      case '-gt': return toNum(a) > toNum(b);
      case '-ge': return toNum(a) >= toNum(b);
    }
    if (op === '&&') return boolVal(a) && boolVal(b);
    if (op === '||') return boolVal(a) || boolVal(b);
  }

  if (args[0] === '!') return !evalTest(args.slice(1));

  return !!args[0];
}

function boolVal(v) {
  return v !== '' && v !== '0' && v !== undefined && v !== null;
}

function fileExists(v) {
  return typeof v === 'string' && v.length > 0 && v !== '0';
}
function isDir(v) {
  return typeof v === 'string' && v.endsWith('/');
}
