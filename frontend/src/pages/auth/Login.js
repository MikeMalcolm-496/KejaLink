/** Login, step 1: email + password. Accounts with 2FA continue to /two-factor. */
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import AuthShell from './AuthShell';
import { Alert, Field, Input, PasswordInput, SubmitButton } from '../../components/ui';
import { api } from '../../api/client';
import { useAuth, homeFor } from '../../context/AuthContext';
import useForm from '../../hooks/useForm';
import useTitle from '../../hooks/useTitle';
import { EMAIL } from '../../utils/validation';

const DEMO = [
  ['Super admin', 'superadmin@kejalink.co.ke'], ['Admin', 'admin@kejalink.co.ke'], ['Agent', 'wanjiru@primehomes.co.ke'],
  ['Agent (pending)', 'kevin@nyumbanirealty.co.ke'], ['Client', 'amina@example.com'],
];

export default function Login() {
  useTitle('Log in');
  const { user, setUser, refresh, demoMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm({ email: '', password: '' });
  const from = location.state && location.state.from;
  const notice = location.state && location.state.message;

  // Already logged in (e.g. opened /login from a bookmark): go home. Skipped while this form is logging in.
  useEffect(() => { if (user && !form.submitting) navigate(homeFor(user.role), { replace: true }); }, [user]);

  const submit = (e) => {
    e.preventDefault();
    form.submit(async (v) => {
      const r = await api.post('/auth/login', v);
      if (r.twoFactorRequired) { navigate('/two-factor', { state: { from } }); return; }
      setUser(r.user);
      await refresh();
      navigate(r.user.must_change_password ? '/change-password' : from || homeFor(r.user.role), { replace: true });
    }, {
      validate: (v) => {
        const e2 = {};
        if (!EMAIL.test(v.email)) e2.email = 'Enter the email you registered with.';
        if (!v.password) e2.password = 'Enter your password.';
        return e2;
      },
    });
  };

  return (
    <AuthShell title="Welcome back" text="Pick up where you left off: saved homes, viewing requests and messages with agents." points={['Licensed agents only', 'Real-time viewing slots', 'Free for clients']}>
      <h1>Log in to KejaLink</h1>
      <p className="muted">New here? <Link to="/register">Create an account</Link></p>
      {notice && <Alert type="info">{notice}</Alert>}
      {form.message && <Alert type="error">{form.message}</Alert>}
      <form onSubmit={submit} noValidate>
        <Field label="Email address" name="email" error={form.errors.email}><Input form={form} name="email" type="email" autoComplete="email" autoFocus maxLength={150} /></Field>
        <Field label="Password" name="password" error={form.errors.password}><PasswordInput form={form} name="password" /></Field>
        <div className="row-between mb-4">
          <span className="xsmall muted">Locked for 15 minutes after 5 wrong tries</span>
          <Link className="small" to="/forgot-password">Forgot password?</Link>
        </div>
        <SubmitButton busy={form.submitting} className="btn btn-primary btn-block" busyText="Checking…">Log in</SubmitButton>
      </form>
      {demoMode && (
        <details className="mt-6 small">
          <summary className="muted" style={{ cursor: 'pointer' }}>Demo accounts (password <code>Password@123</code>)</summary>
          <table className="demo-table"><tbody>
            {DEMO.map(([role, email]) => (
              <tr key={email}><td>{role}</td><td><button type="button" onClick={() => form.setValues({ email, password: 'Password@123' })}>{email}</button></td></tr>
            ))}
          </tbody></table>
        </details>
      )}
    </AuthShell>
  );
}
