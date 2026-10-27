/**
 * Учебная политика bash: umask и режимы оболочки.
 * По умолчанию: umask 022.
 */

export let umask = '022';

export function getUmask() {
  return umask;
}

export function setUmask(value) {
  umask = value || umask;
}

export function resetUmask() {
  umask = '022';
}

let strictMode = false;
let noclobber = false;

export function getStrictMode() {
  return strictMode;
}

export function setStrictMode(value) {
  strictMode = value;
}

export function getNoclobber() {
  return noclobber;
}

export function setNoclobber(value) {
  noclobber = value;
}

export function resetPolicies() {
  umask = '022';
  strictMode = false;
  noclobber = false;
}
