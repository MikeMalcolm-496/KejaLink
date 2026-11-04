/**
 * validation.js: the same rules the server checks, run in the browser first
 * so users get instant feedback. (The server still checks everything.)
 */
export const PHONE = /^(\+?254|0)(7|1)\d{8}$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function passwordProblem(pw) {
  if (!pw) return 'Password is required.';
  if (pw.length < 8 || !/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw)) {
    return 'Use at least 8 characters with an upper-case letter, a lower-case letter and a number.';
  }
  return null;
}

/** 0-4 score for the strength bar. */
export function passwordScore(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
  return s;
}

/** Key trapping: allow only digits (and optional + at the start for phones). */
export function digitsOnly(e, allowPlus = false) {
  const control = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', 'Escape'];
  if (control.includes(e.key) || e.ctrlKey || e.metaKey) return;
  const plusOk = allowPlus && e.key === '+' && e.currentTarget.selectionStart === 0 && !e.currentTarget.value.includes('+');
  if (!/^\d$/.test(e.key) && !plusOk) e.preventDefault();
}
