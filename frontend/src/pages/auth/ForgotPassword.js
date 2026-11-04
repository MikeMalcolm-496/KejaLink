/** Request a single-use password reset link (valid 30 minutes). */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Alert, Field, Input, SubmitButton } from '../../components/ui';
import { api } from '../../api/client';
import useForm from '../../hooks/useForm';
import useTitle from '../../hooks/useTitle';
import { EMAIL } from '../../utils/validation';

export default function ForgotPassword() {
  useTitle('Forgot password');
  const form = useForm({ email: '' });
  const [result, setResult] = useState(null);
  const submit = (e) => {
    e.preventDefault();
    form.submit(async (v) => setResult(await api.post('/auth/forgot-password', v)), { validate: (v) => (EMAIL.test(v.email) ? {} : { email: 'Enter a valid email address.' }) });
  };
  return (
    <div className="card narrow">
      <div style={{ textAlign: 'center' }}><Icon name="key" size={36} /><h1 className="mt-4" style={{ fontSize: 'var(--text-2xl)' }}>Forgot your password?</h1>
        <p className="muted">Enter your email and we'll send a link to choose a new one.</p></div>
      {result && <Alert type="success">{result.message}</Alert>}
      {result && result.demoLink && <Alert type="info"><b>Demo mail mode:</b> e-mails are saved on the server instead of sent. <Link to={result.demoLink}>Open the reset link</Link></Alert>}
      {form.message && <Alert type="error">{form.message}</Alert>}
      <form onSubmit={submit} noValidate>
        <Field label="Email address" name="email" error={form.errors.email}><Input form={form} name="email" type="email" autoFocus maxLength={150} /></Field>
        <SubmitButton busy={form.submitting} className="btn btn-primary btn-block" busyText="Sending…">Send reset link</SubmitButton>
      </form>
      <p className="small mt-4 mb-0" style={{ textAlign: 'center' }}><Link to="/login">← Back to log in</Link></p>
    </div>
  );
}
