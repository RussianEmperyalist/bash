/** Общее для всех страниц: состояние, навигация в шапке, индикатор прогресса. */
import { initState, completedCount, progressPercent, TOTAL_LESSONS } from '../app.js';

export const $ = (s) => document.querySelector(s);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initPage() {
  initState();
  document.querySelectorAll('[data-go]').forEach((b) => {
    b.onclick = () => { location.href = b.dataset.go; };
  });
  refreshHeader();
}

export function refreshHeader() {
  const bar = $('#bar');
  if (bar) bar.style.width = progressPercent(TOTAL_LESSONS) + '%';
  const pc = $('#pc');
  if (pc) pc.textContent = completedCount() + ' / ' + TOTAL_LESSONS;
}
