/**
 * Алиасы bash: короткие имена → полные утилиты.
 * В Linux большинство алиасов уже являются основными именами команд.
 * Этот словарь нужен для разрешения сокращённых форм и поиска команд.
 */

export const aliases = {
  ll: 'ls -l',
  la: 'ls -la',
  grep: 'grep',
  egrep: 'grep -E',
  fgrep: 'grep -F',
  md: 'mkdir',
  rmdir: 'rmdir',
  r: 'r',
  mkdir: 'mkdir',
  rm: 'rm',
  mv: 'mv',
  cp: 'cp',
  cat: 'cat',
  less: 'less',
  more: 'more',
  vi: 'vi',
  vim: 'vim',
  nano: 'nano',
  cls: 'clear'
};

/** Разрешить алиас. Возвращает развернутую строку или null. */
export function resolveAlias(name) {
  const lower = name.toLowerCase();
  return aliases[lower] || null;
}

/** Получить список всех доступных команд (имена). */
export function getBashCommandNames() {
  return Object.keys(aliases).sort();
}
