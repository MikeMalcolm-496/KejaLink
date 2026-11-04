/** Choose a new password using the token from the e-mailed link. */
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Field, Loading, PasswordInput, SubmitButton } from '../../components/ui';
import { api } from '../../api/client';
import useApi from '../../hooks/useApi';
import useForm from '../../hooks/useForm';
import useTitle from '../../hooks/useTitle';
import { passwordProblem } from '../../utils/validation';

export default function ResetPassword() {
  useTitle('Reset password');
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const check = useApi('/auth/reset-password', { token });
  const form = useForm({ password: '', password_confirm: '' });

  if (check.loading) return <Loading />;
  if (!check.data || !check.data.valid) {
    return (
      <div className="card narrow" style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)' }}>This reset link is invalid or has expired</h1>
        <p className="muted">Reset links work once and expire after 30 minutes.</p>
        <Link to="/forgot-password" className="btn btn-primary">Request a new link</Link>
      </div>
    );
  }
  const submit = (e) => {
    e.preventDefault();
    form.submit(async (v) => {
      const r = await api.post('/auth/reset-password', { ...v, token });
      navigate('/login', { state: { message: r.message } });
    }, { validate: (v) => { const er = {}; const p = passwordProblem(v.password); if (p) er.password = p; if (v.password !== v.password_confirm) er.password_confirm = 'The two passwords do not match.'; return er; } });
  };
  return (
    <div className="card narrow">
      <h1 style={{ fontSize: 'var(--text-2xl)' }}>Choose a new password</h1>
      <p className="muted">For {check.data.email}</p>
      {form.message && <Alert type="error">{form.message}</Alert>}
      <form onSubmit={submit} noValidate>
        <Field label="New password" name="password" error={form.errors.password}><PasswordInput form={form} name="password" meter autoComplete="new-password" /></Field>
        <Field label="Confirm new password" name="password_confirm" error={form.errors.password_confirm}><PasswordInput form={form} name="password_confirm" autoComplete="new-password" /></Field>
        <SubmitButton busy={form.submitting} className="btn btn-primary btn-block">Save new password</SubmitButton>
      </form>
    </div>
  );
}
