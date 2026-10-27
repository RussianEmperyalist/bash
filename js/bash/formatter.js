/**
 * Форматирование вывода команд bash для терминала.
 * В bash каждая команда форматирует собственный вывод, поэтому здесь
 * просто объединяем строки результата через перевод строки.
 */

export function formatOutput(results) {
  if (!results || !results.length) return '';
  if (typeof results === 'string') return results;
  const lines = [];
  for (const r of results) {
    if (Array.isArray(r)) {
      lines.push(...r);
    } else if (r && typeof r === 'object' && r.lines) {
      lines.push(...(r.lines || []));
    } else {
      lines.push(String(r));
    }
  }
  return lines.join('\n');
}
