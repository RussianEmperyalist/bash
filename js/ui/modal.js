/**
 * Модальные окна.
 * Простая модалка: overlay + escape + focus trap.
 */

let activeModal = null;

export function showModal(title, body, buttons) {
  hideModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '1000'
  });

  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';
  Object.assign(dialog.style, {
    background: 'var(--pn)',
    border: '1px solid var(--bd)',
    borderRadius: '12px',
    maxWidth: '480px',
    width: '90vw',
    maxHeight: '80vh',
    overflow: 'auto',
    padding: '20px',
    color: 'var(--tx)',
    boxSizing: 'border-box'
  });

  const titleEl = document.createElement('h2');
  titleEl.textContent = title;
  titleEl.style.marginTop = '0';
  dialog.appendChild(titleEl);

  const bodyEl = document.createElement('div');
  bodyEl.innerHTML = body;
  dialog.appendChild(bodyEl);

  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '8px';
  btnRow.style.justifyContent = 'flex-end';
  btnRow.style.marginTop = '16px';

  buttons = buttons || [{ label: 'OK' }];
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.textContent = b.label;
    btn.type = 'button';
    btn.style.padding = '6px 14px';
    btn.style.borderRadius = '8px';
    btn.style.border = '1px solid var(--bd)';
    btn.style.background = b.primary ? 'var(--ac)' : 'var(--pn)';
    btn.style.color = b.primary ? '#fff' : 'var(--tx)';
    if (b.onclick) btn.onclick = (e) => { b.onclick(e); hideModal(); };
    btnRow.appendChild(btn);
  });

  dialog.appendChild(btnRow);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  activeModal = overlay;

  const focusable = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (first) first.focus();

  const onKeydown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); hideModal(); return; }
    if (e.key === 'Tab' && focusable.length > 1) {
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  dialog.addEventListener('keydown', onKeydown);
  overlay._onKeydown = onKeydown;

  return overlay;
}

export function hideModal() {
  if (activeModal) {
    if (activeModal._onKeydown) {
      activeModal.removeEventListener('keydown', activeModal._onKeydown);
    }
    const dialog = activeModal.querySelector('.modal-dialog');
    if (dialog && dialog.contains(document.activeElement)) {
      const prev = document.activeElement;
      activeModal.remove();
      if (prev) prev.blur();
    } else {
      activeModal.remove();
    }
    activeModal = null;
  }
}
