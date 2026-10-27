/**
 * Тосты (всплывающие уведомления).
 */

export function showToast(text, duration) {
  let el = document.querySelector('#ts');
  if (!el) return;
  el.textContent = text;
  el.className = 'on';
  setTimeout(() => { el.className = ''; }, duration || 2200);
}
