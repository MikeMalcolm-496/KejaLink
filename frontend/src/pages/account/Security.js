/**
 * Password change and two-factor authentication.
 * Enabling 2FA: the server makes a secret and a QR code; it is only saved
 * after the user proves the app works by typing a correct code.
 */
import { useState } from 'react';
import { Alert, Field, Loading, PasswordInput, StatusBadge, SubmitButton } from '../../components/ui';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import useForm from '../../hooks/useForm';
import useTitle from '../../hooks/useTitle';
import { digitsOnly, passwordProblem } from '../../utils/validation';

export default function Security() {
  useTitle('Password & 2FA');
  const { refresh } = useAuth();
  const toast = useToast();
  const setup = useApi('/me/2fa');
  const pw = useForm({ current_password: '', password: '', password_confirm: '' });
  const enable = useForm({ code: '' });
  const disable = useForm({ current_password: '' });
  const [, force] = useState(0);

  const changePassword = (e) => {
    e.preventDefault();
    pw.submit(async (v) => { toast.success((await api.put('/me/password', v)).message); pw.setValues({ current_password: '', password: '', password_confirm: '' }); }, {
      validate: (v) => { const er = {}; if (!v.current_password) er.current_password = 'Enter your current password.'; const p = passwordProblem(v.password); if (p) er.password = p; if (v.password !== v.password_confirm) er.password_confirm = 'The two new passwords do not match.'; return er; },
    });
  };
  const turnOn = (e) => {
    e.preventDefault();
    enable.submit(async (v) => { toast.success((await api.post('/me/2fa', v)).message); await refresh(); setup.reload(); force((n) => n + 1); },
      { validate: (v) => (/^\d{6}$/.test(v.code) ? {} : { code: 'Enter the 6 digits from your app.' }) });
  };
  const turnOff = (e) => {
    e.preventDefault();
    disable.submit(async (v) => { toast.success((await api.delete('/me/2fa', v)).message); disable.setValues({ current_password: '' }); await refresh(); setup.reload(); });
  };

  return (
    <>
      <div className="page-head"><div><h1>Password &amp; security</h1><p>Protect your account with a strong password and two-factor authentication.</p></div></div>
      <div className="grid-2">
        <form className="card" onSubmit={changePassword} noValidate>
          <h2 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>Change password</h2>
          {pw.message && <Alert type="error">{pw.message}</Alert>}
          <Field label="Current password" name="current_password" error={pw.errors.current_password}><PasswordInput form={pw} name="current_password" /></Field>
          <Field label="New password" name="password" error={pw.errors.password}><PasswordInput form={pw} name="password" meter autoComplete="new-password" /></Field>
          <Field label="Confirm new password" name="password_confirm" error={pw.errors.password_confirm}><PasswordInput form={pw} name="password_confirm" autoComplete="new-password" /></Field>
          <SubmitButton busy={pw.submitting}>Update password</SubmitButton>
        </form>
        <div className="card">
          <div className="card-title"><h2>Two-factor authentication</h2>{setup.data && (setup.data.enabled ? <StatusBadge status="active" /> : <span className="badge tone-neutral">Off</span>)}</div>
          {setup.loading ? <Loading /> : setup.data && setup.data.enabled ? (
            <form onSubmit={turnOff} noValidate>
              <p>Each login asks for a 6-digit code from your phone, so a stolen password alone cannot open your account.</p>
              {disable.message && <Alert type="error">{disable.message}</Alert>}
              <Field label="Confirm with your password to turn it off" name="current_password" error={disable.errors.current_password}><PasswordInput form={disable} name="current_password" /></Field>
              <SubmitButton busy={disable.submitting} className="btn btn-danger">Turn off 2FA</SubmitButton>
            </form>
          ) : setup.data && (
            <form onSubmit={turnOn} noValidate>
              <ol className="small" style={{ paddingLeft: 18 }}>
                <li>Install <b>Google Authenticator</b>, Authy or Microsoft Authenticator.</li>
                <li>Scan this QR code with the app:</li>
              </ol>
              <div className="row mb-4" style={{ alignItems: 'flex-start' }}>
                {/* The SVG comes from our own server (qrcode library), not from user input */}
                <div className="qr-box" aria-label="QR code for your authenticator app" dangerouslySetInnerHTML={{ __html: setup.data.qrSvg }} />
                <div className="small">Can't scan? Enter this key:<br /><code style={{ wordBreak: 'break-all' }}>{setup.data.secret.match(/.{1,4}/g).join(' ')}</code></div>
              </div>
              {enable.message && <Alert type="error">{enable.message}</Alert>}
              <Field label="3. Enter the 6-digit code shown in the app" name="code" error={enable.errors.code}>
                <div className="input-group">
                  <input id="code" className="input" inputMode="numeric" maxLength={6} placeholder="123456" onKeyDown={digitsOnly} {...enable.bind('code')} />
                  <SubmitButton busy={enable.submitting}>Turn on 2FA</SubmitButton>
                </div>
              </Field>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
