/** Registration for clients and agents (FR1). Agents wait for admin verification. */
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from './AuthShell';
import Icon from '../../components/Icon';
import { Alert, Field, Input, PasswordInput, SubmitButton } from '../../components/ui';
import { api } from '../../api/client';
import { useAuth, homeFor } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useForm from '../../hooks/useForm';
import useTitle from '../../hooks/useTitle';
import { EMAIL, PHONE, passwordProblem } from '../../utils/validation';

function validate(v) {
  const e = {};
  if (!/^[\p{L} .'-]{3,100}$/u.test(v.full_name.trim())) e.full_name = 'Enter your full name (letters only, at least 3 characters).';
  if (!EMAIL.test(v.email)) e.email = 'Enter a valid email address.';
  if (!PHONE.test(v.phone)) e.phone = 'Use a Kenyan number, e.g. 0712345678.';
  if (v.role === 'agent' && !/^[A-Za-z0-9/-]{4,30}$/.test(v.licence_no)) e.licence_no = 'Enter your licence number, e.g. EARB/2024/0153.';
  const pw = passwordProblem(v.password);
  if (pw) e.password = pw;
  if (v.password !== v.password_confirm) e.password_confirm = 'The two passwords do not match.';
  if (!v.terms) e.terms = 'You must accept the terms of use.';
  return e;
}

export default function Register() {
  useTitle('Create account');
  const [params] = useSearchParams();
  const { setUser, refresh } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const form = useForm({ role: params.get('role') === 'agent' ? 'agent' : 'client', full_name: '', email: '', phone: '', licence_no: '', agency_name: '', password: '', password_confirm: '', terms: false });
  const isAgent = form.values.role === 'agent';

  const submit = (e) => {
    e.preventDefault();
    form.submit(async (v) => {
      const r = await api.post('/auth/register', v);
      setUser(r.user);
      await refresh();
      toast.success(isAgent ? 'Account created. Your licence is awaiting verification.' : 'Account created. Welcome to KejaLink!');
      navigate(homeFor(r.user.role));
    }, { validate });
  };

  return (
    <AuthShell title="Join KejaLink" text="Clients find verified homes and book viewings. Agents manage every listing, inquiry and viewing in one place." points={['Verified, licensed agents', 'Book viewings in real time', 'Free for clients']}>
      <h1>Create your account</h1>
      <p className="muted">Already registered? <Link to="/login">Log in</Link></p>
      {form.message && <Alert type="error">{form.message}</Alert>}
      <form onSubmit={submit} noValidate>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small bold mb-2">I am a</legend>
          <div className="role-picker">
            <label className="role-option"><input type="radio" name="role" value="client" checked={!isAgent} onChange={() => form.set('role', 'client')} /><Icon name="home" /><span><b>Client</b><br /><span className="xsmall muted">Looking to rent or buy</span></span></label>
            <label className="role-option"><input type="radio" name="role" value="agent" checked={isAgent} onChange={() => form.set('role', 'agent')} /><Icon name="id" /><span><b>Agent</b><br /><span className="xsmall muted">Licensed real estate agent</span></span></label>
          </div>
        </fieldset>
        <Field label="Full name" name="full_name" required error={form.errors.full_name}><Input form={form} name="full_name" autoComplete="name" maxLength={100} /></Field>
        <div className="form-grid">
          <Field label="Email" name="email" required error={form.errors.email}><Input form={form} name="email" type="email" autoComplete="email" maxLength={150} /></Field>
          <Field label="Phone" name="phone" required error={form.errors.phone} hint="e.g. 0712345678"><Input form={form} name="phone" type="phone" autoComplete="tel" maxLength={13} /></Field>
        </div>
        {isAgent && (
          <div className="form-grid">
            <Field label="Licence number" name="licence_no" required error={form.errors.licence_no} hint="EARB number. An admin verifies it."><Input form={form} name="licence_no" maxLength={30} placeholder="EARB/2024/0153" /></Field>
            <Field label="Agency name" name="agency_name" error={form.errors.agency_name} hint="Leave blank if independent"><Input form={form} name="agency_name" maxLength={100} /></Field>
          </div>
        )}
        <div className="form-grid">
          <Field label="Password" name="password" required error={form.errors.password}><PasswordInput form={form} name="password" meter autoComplete="new-password" /></Field>
          <Field label="Confirm password" name="password_confirm" required error={form.errors.password_confirm}><PasswordInput form={form} name="password_confirm" autoComplete="new-password" /></Field>
        </div>
        <p className="xsmall muted">At least 8 characters with an upper-case letter, a lower-case letter and a number.</p>
        <div className="field">
          <label className="check"><input type="checkbox" {...form.bind('terms', 'checkbox')} /><span>I agree to the <Link to="/help#terms" target="_blank">terms of use</Link> and privacy policy.</span></label>
          {form.errors.terms && <span className="field-error" id="terms-error">{form.errors.terms}</span>}
        </div>
        <SubmitButton busy={form.submitting} className="btn btn-primary btn-block" busyText="Creating account…">Create account</SubmitButton>
      </form>
    </AuthShell>
  );
}
