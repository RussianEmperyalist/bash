/**
 * Единая точка работы с localStorage.
 * Никакой другой модуль не должен обращаться к localStorage напрямую.
 */

const STORAGE_KEY = 'bash4all';

export function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch (e) {
    return null;
  }
}

export function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage недоступен (приватный режим, переполнение) — молча игнорируем
  }
}

export function clear() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}
