/** Login, step 2: the 6-digit code from the authenticator app. */
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Alert, SubmitButton } from '../../components/ui';
import { api } from '../../api/client';
import { useAuth, homeFor } from '../../context/AuthContext';
import useForm from '../../hooks/useForm';
import useTitle from '../../hooks/useTitle';
import { digitsOnly } from '../../utils/validation';

export default function TwoFactor() {
  useTitle('Two-factor authentication');
  const { setUser, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm({ code: '' });

  const verify = (code) => form.submit(async () => {
    try {
      const r = await api.post('/auth/2fa', { code });
      setUser(r.user);
      await refresh();
      navigate((location.state && location.state.from) || homeFor(r.user.role), { replace: true });
    } catch (err) {
      if (err.fields.code === 'RESTART_LOGIN') navigate('/login', { state: { message: err.message } });
      form.setValues({ code: '' });
      throw err;
    }
  });

  const onChange = (e) => {
    const code = e.target.value.replace(/\D/g, '').slice(0, 6);
    form.set('code', code);
    if (code.length === 6) verify(code);       // submit automatically after 6 digits
  };

  return (
    <div className="card narrow" style={{ textAlign: 'center' }}>
      <Icon name="mobile" size={40} />
      <h1 className="mt-4" style={{ fontSize: 'var(--text-2xl)' }}>Enter your 6-digit code</h1>
      <p className="muted">Open Google Authenticator (or Authy / Microsoft Authenticator) and type the code shown for <b>KejaLink</b>.</p>
      {form.message && <Alert type="error">{form.message}</Alert>}
      <form onSubmit={(e) => { e.preventDefault(); verify(form.values.code); }} noValidate>
        <label htmlFor="code" className="sr-only">Authentication code</label>
        <input id="code" className="input otp mb-4" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} value={form.values.code} onKeyDown={digitsOnly} onChange={onChange} />
        <SubmitButton busy={form.submitting} className="btn btn-primary btn-block" disabled={form.values.code.length !== 6} busyText="Verifying…">Verify and log in</SubmitButton>
      </form>
      <p className="small muted mt-6 mb-0">Lost your phone? Ask an administrator to turn off 2FA for your account.</p>
    </div>
  );
}
