/** Edit own profile. Agents also edit agency name and bio. */
import { Alert, Field, Input, SubmitButton, TextArea, StatusBadge, useUnsavedWarning } from '../../components/ui';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useForm from '../../hooks/useForm';
import useTitle from '../../hooks/useTitle';
import { fmtDate, fmtDateTime, roleLabel } from '../../utils/format';
import { EMAIL, PHONE } from '../../utils/validation';

export default function Profile() {
  useTitle('Profile');
  const { user, setUser } = useAuth();
  const toast = useToast();
  const form = useForm({ full_name: user.full_name, email: user.email, phone: user.phone, agency_name: user.agency_name || '', bio: user.bio || '' });
  useUnsavedWarning(form.dirty);
  const submit = (e) => {
    e.preventDefault();
    form.submit(async (v) => { const r = await api.put('/me/profile', v); setUser(r.user); toast.success(r.message); }, {
      validate: (v) => { const er = {}; if (v.full_name.trim().length < 3) er.full_name = 'Enter your full name.'; if (!EMAIL.test(v.email)) er.email = 'Enter a valid email.'; if (!PHONE.test(v.phone)) er.phone = 'Use a Kenyan number, e.g. 0712345678.'; return er; },
    });
  };
  return (
    <>
      <div className="page-head"><div><h1>Your profile</h1><p>Keep your contact details up to date{user.role === 'agent' ? '. Clients see your name, agency and phone on your listings' : ''}.</p></div></div>
      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)' }}>
        <form className="card" onSubmit={submit} noValidate>
          {form.message && <Alert type="error">{form.message}</Alert>}
          <Field label="Full name" name="full_name" required error={form.errors.full_name}><Input form={form} name="full_name" maxLength={100} /></Field>
          <div className="form-grid">
            <Field label="Email" name="email" required error={form.errors.email}><Input form={form} name="email" type="email" maxLength={150} /></Field>
            <Field label="Phone" name="phone" required error={form.errors.phone}><Input form={form} name="phone" type="phone" maxLength={13} /></Field>
          </div>
          {user.role === 'agent' && <>
            <div className="form-grid">
              <Field label="Licence number" name="licence" hint="Contact an admin to change it."><input id="licence" className="input" value={user.licence_no} disabled /></Field>
              <Field label="Agency name" name="agency_name" error={form.errors.agency_name}><Input form={form} name="agency_name" maxLength={100} /></Field>
            </div>
            <Field label="About you" name="bio" error={form.errors.bio}><TextArea form={form} name="bio" maxLength={500} rows={3} placeholder="Areas you cover, years of experience, languages…" /></Field>
          </>}
          <SubmitButton busy={form.submitting}>Save changes</SubmitButton>
        </form>
        <div className="card">
          <div className="row mb-4"><span className="avatar avatar-lg">{user.full_name.charAt(0)}</span><div><b>{user.full_name}</b><div className="small muted">{roleLabel(user.role)}</div></div></div>
          <dl className="small mb-0">
            <dt className="muted">Member since</dt><dd className="mb-2" style={{ marginLeft: 0 }}>{fmtDate(user.created_at)}</dd>
            <dt className="muted">Last login</dt><dd className="mb-2" style={{ marginLeft: 0 }}>{fmtDateTime(user.last_login_at)}</dd>
            {user.role === 'agent' && <><dt className="muted">Verification</dt><dd className="mb-2" style={{ marginLeft: 0 }}><StatusBadge status={user.verification_status} /></dd></>}
            <dt className="muted">Two-factor authentication</dt><dd style={{ marginLeft: 0 }}>{user.twofa_enabled ? <StatusBadge status="active" /> : 'Off'}</dd>
          </dl>
        </div>
      </div>
    </>
  );
}
