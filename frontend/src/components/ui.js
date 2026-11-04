/**
 * ui.js: small reusable building blocks used on almost every page.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { label } from '../utils/format';
import { passwordScore, digitsOnly } from '../utils/validation';

/** Labelled form field with an error message underneath. */
export function Field({ label: text, name, error, hint, required, children }) {
  return (
    <div className="field">
      {text && <label htmlFor={name} className={required ? 'required' : ''}>{text}</label>}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error" id={`${name}-error`}><Icon name="alert" size={16} />{error}</span>}
    </div>
  );
}

/** Text input bound to useForm. type="digits" or "phone" adds key trapping. */
export function Input({ form, name, type = 'text', ...rest }) {
  const numeric = type === 'digits' || type === 'phone';
  return (
    <input
      className="input"
      type={numeric ? 'text' : type}
      inputMode={numeric ? 'numeric' : undefined}
      onKeyDown={numeric ? (e) => digitsOnly(e, type === 'phone') : undefined}
      {...form.bind(name)}
      {...rest}
    />
  );
}

/** Textarea with a live character counter. */
export function TextArea({ form, name, maxLength = 1000, rows = 4, ...rest }) {
  const length = String(form.values[name] || '').length;
  return (
    <>
      <textarea className="textarea" rows={rows} maxLength={maxLength} {...form.bind(name)} {...rest} />
      <span className={`char-count ${length >= maxLength ? 'over' : ''}`}>{length} / {maxLength}</span>
    </>
  );
}

/** Password input with show/hide button and optional strength meter. */
export function PasswordInput({ form, name, meter = false, autoComplete = 'current-password' }) {
  const [show, setShow] = useState(false);
  const value = form.values[name] || '';
  const score = passwordScore(value);
  const colours = ['#b0362a', '#b0362a', '#c8790f', '#2f8a63', '#0e5a47'];
  const words = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  return (
    <>
      <div className="input-group">
        <input className="input" type={show ? 'text' : 'password'} autoComplete={autoComplete} {...form.bind(name)} />
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
          <Icon name={show ? 'eyeOff' : 'eye'} />
        </button>
      </div>
      {meter && value && (
        <>
          <div className="strength" aria-hidden="true"><span style={{ width: `${score * 25}%`, background: colours[score] }} /></div>
          <span className="field-hint">Strength: {words[score]}</span>
        </>
      )}
    </>
  );
}

/** Submit button that shows a spinner and disables itself while saving (prevents double submits). */
export function SubmitButton({ busy, children, className = 'btn btn-primary', busyText = 'Please wait…', ...rest }) {
  return (
    <button type="submit" className={className} disabled={busy} {...rest}>
      {busy ? <><span className="spinner" aria-hidden="true" />{busyText}</> : children}
    </button>
  );
}

const TONES = {
  available: 'good', confirmed: 'good', approved: 'good', active: 'good', replied: 'good', success: 'good', completed: 'neutral',
  under_offer: 'warn', requested: 'warn', pending: 'warn', open: 'warn',
  rescheduled: 'info',
  sold: 'neutral', rented: 'neutral', closed: 'neutral', cancelled: 'neutral', resolved: 'neutral',
  removed: 'bad', declined: 'bad', rejected: 'bad', suspended: 'bad', failed: 'bad',
};
export function StatusBadge({ status }) {
  return <span className={`badge tone-${TONES[status] || 'neutral'}`}>{label(status)}</span>;
}

export function Alert({ type = 'info', children }) {
  const icon = { success: 'check', error: 'alert', warn: 'alert', info: 'info' }[type];
  return <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}><Icon name={icon} /><div>{children}</div></div>;
}

export function EmptyState({ icon = 'search', title, text, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={44} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Loading({ text = 'Loading…' }) {
  return <div className="page-loading" role="status"><span className="spinner" style={{ width: 28, height: 28 }} /><span>{text}</span></div>;
}

/** Shows an error from useApi with a retry button. */
export function LoadError({ error, retry }) {
  return (
    <Alert type="error">
      {error.message} {retry && <button className="btn-link" onClick={retry}>Try again</button>}
    </Alert>
  );
}

export function StatCard({ label: text, value, icon, highlight, to }) {
  const body = (
    <>
      <div className="stat-label"><span>{text}</span><Icon name={icon} /></div>
      <div className="stat-value">{value}</div>
    </>
  );
  return to ? <Link to={to} className={`stat ${highlight ? 'highlight' : ''}`}>{body}</Link> : <div className={`stat ${highlight ? 'highlight' : ''}`}>{body}</div>;
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  const nums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i);
  return (
    <nav className="pagination" aria-label="Pages">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1}>Prev</button>
      {nums.map((n) => <button key={n} className={n === page ? 'active' : ''} aria-current={n === page ? 'page' : undefined} onClick={() => onChange(n)}>{n}</button>)}
      <button onClick={() => onChange(page + 1)} disabled={page >= pages}>Next</button>
    </nav>
  );
}

/** Clickable table header that sorts by a column. */
export function SortHeader({ field, children, sort, dir, onSort }) {
  const active = sort === field;
  return (
    <th aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button className="sort-btn" onClick={() => onSort(field, active && dir === 'asc' ? 'desc' : 'asc')}>
        {children} <Icon name={active ? (dir === 'asc' ? 'sortUp' : 'sortDown') : 'sort'} size={14} />
      </button>
    </th>
  );
}

/** Accessible modal dialog. Closes on Escape and on clicking the backdrop. */
export function Modal({ title, onClose, children, footer, wide }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {   // runs once when the dialog opens
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    const first = ref.current && ref.current.querySelector('input, textarea, select, button.btn');
    if (first) first.focus();
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref} style={wide ? { maxWidth: 640 } : undefined}>
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Confirmation before destructive actions.
 * const [confirm, dialog] = useConfirm();  ... {dialog} ...
 * if (await confirm({ title, text, confirmText })) { ...do it... }
 */
export function useConfirm() {
  const [state, setState] = useState(null);
  const confirm = (opts) => new Promise((resolve) => setState({ ...opts, resolve }));
  const close = (answer) => { state.resolve(answer); setState(null); };
  const dialog = state && (
    <Modal title={state.title || 'Please confirm'} onClose={() => close(false)}
      footer={<>
        <button className="btn btn-ghost" onClick={() => close(false)}>Cancel</button>
        <button className={`btn ${state.tone === 'primary' ? 'btn-primary' : 'btn-danger-solid'}`} onClick={() => close(true)}>{state.confirmText || 'Yes, continue'}</button>
      </>}>
      <p className="mb-0">{state.text}</p>
    </Modal>
  );
  return [confirm, dialog];
}

/** Dialog that asks for a written reason (reject, suspend, remove, decline). */
export function ReasonDialog({ title, text, confirmText = 'Confirm', min = 5, onSubmit, onClose }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < min) { setError(`Please write at least ${min} characters.`); return; }
    setBusy(true);
    try { await onSubmit(reason.trim()); onClose(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {text && <p className="muted small">{text}</p>}
        <div className="field">
          <label htmlFor="reason">Reason</label>
          <textarea id="reason" className="textarea" rows={3} maxLength={255} value={reason} onChange={(e) => { setReason(e.target.value); setError(null); }} aria-invalid={error ? 'true' : undefined} />
          {error && <span className="field-error"><Icon name="alert" size={16} />{error}</span>}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <SubmitButton busy={busy} className="btn btn-danger-solid">{confirmText}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

/** Warn before leaving a page with unsaved changes (browser close / reload). */
export function useUnsavedWarning(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}
