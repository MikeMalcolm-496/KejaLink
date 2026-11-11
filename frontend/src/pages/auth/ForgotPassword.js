/** Request an administrator-assisted password reset. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from './AuthShell';
import { Alert, Field, Input, SubmitButton } from '../../components/ui';
import { api } from '../../api/client';
import useForm from '../../hooks/useForm';
import useTitle from '../../hooks/useTitle';
import { EMAIL } from '../../utils/validation';

export default function ForgotPassword() {
  useTitle('Forgot password');
  const form = useForm({ email: '' });
  const [sent, setSent] = useState('');

  const submit = (e) => {
    e.preventDefault();
    form.submit(async (values) => {
      const response = await api.post('/auth/forgot-password', values);
      setSent(response.message);
    }, {
      validate: (values) => (EMAIL.test(values.email) ? {} : { email: 'Enter the email you registered with.' }),
    });
  };

  return (
    <AuthShell title="Locked out?" text="Request help from an administrator to regain access to your account." points={['Administrators review reset requests', 'You will need to change your temporary password at login']}>
      <h1>Forgot your password?</h1>
      <p className="muted">Remembered it? <Link to="/login">Back to log in</Link></p>
      {sent && <Alert type="info">{sent}</Alert>}
      {form.message && <Alert type="error">{form.message}</Alert>}
      {!sent && (
        <form onSubmit={submit} noValidate>
          <Field label="Email address" name="email" error={form.errors.email}>
            <Input form={form} name="email" type="email" autoComplete="email" autoFocus maxLength={150} />
          </Field>
          <SubmitButton busy={form.submitting} className="btn btn-primary btn-block" busyText="Sending…">Request password reset</SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
