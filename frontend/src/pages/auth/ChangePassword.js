/** Forced password change after an admin issued a temporary password. */
import { Navigate, useNavigate } from 'react-router-dom';
import { Alert, Field, PasswordInput, SubmitButton } from '../../components/ui';
import { api } from '../../api/client';
import { useAuth, homeFor } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useForm from '../../hooks/useForm';
import useTitle from '../../hooks/useTitle';
import { passwordProblem } from '../../utils/validation';

export default function ChangePassword() {
  useTitle('Set a new password');
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const form = useForm({ password: '', password_confirm: '' });
  if (!user.must_change_password) return <Navigate to="/account/security" replace />;
  const submit = (e) => {
    e.preventDefault();
    form.submit(async (v) => {
      const r = await api.post('/auth/change-temporary-password', v);
      setUser(r.user);
      toast.success('Password updated. Welcome!');
      navigate(homeFor(r.user.role), { replace: true });
    }, { validate: (v) => { const er = {}; const p = passwordProblem(v.password); if (p) er.password = p; if (v.password !== v.password_confirm) er.password_confirm = 'The two passwords do not match.'; return er; } });
  };
  return (
    <div className="card narrow">
      <h1 style={{ fontSize: 'var(--text-2xl)' }}>Set your own password</h1>
      <p className="muted">An administrator gave you a temporary password. Choose a new one to continue.</p>
      {form.message && <Alert type="error">{form.message}</Alert>}
      <form onSubmit={submit} noValidate>
        <Field label="New password" name="password" error={form.errors.password}><PasswordInput form={form} name="password" meter autoComplete="new-password" /></Field>
        <Field label="Confirm new password" name="password_confirm" error={form.errors.password_confirm}><PasswordInput form={form} name="password_confirm" autoComplete="new-password" /></Field>
        <SubmitButton busy={form.submitting} className="btn btn-primary btn-block">Save password</SubmitButton>
      </form>
    </div>
  );
}
