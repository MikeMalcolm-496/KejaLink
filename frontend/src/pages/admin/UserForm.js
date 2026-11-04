/** Admin: register a new user (temporary password) or edit one. Only super admins create admins. */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Field, Input, Loading, Modal, SubmitButton } from '../../components/ui';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useForm from '../../hooks/useForm';
import useTitle from '../../hooks/useTitle';
import { roleLabel } from '../../utils/format';
import { EMAIL, PHONE } from '../../utils/validation';

export default function UserForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  useTitle(id ? 'Edit user' : 'Register user');
  const { user: me } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const roles = me.role === 'super_admin' ? ['client', 'agent', 'admin'] : ['client', 'agent'];
  const form = useForm({ role: roles.includes(params.get('role')) ? params.get('role') : 'client', full_name: '', email: '', phone: '', licence_no: '', agency_name: '' });
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState(null);
  const [created, setCreated] = useState(null);

  useEffect(() => {
    if (!id) return;
    api.get(`/admin/users/${id}`).then((u) => form.setValues({ role: u.role, full_name: u.full_name, email: u.email, phone: u.phone, licence_no: u.licence_no || '', agency_name: u.agency_name || '' }))
      .catch(setLoadError).finally(() => setLoading(false));
  }, [id]);

  const isAgent = form.values.role === 'agent';
  const submit = (e) => {
    e.preventDefault();
    form.submit(async (v) => {
      const r = id ? await api.put(`/admin/users/${id}`, v) : await api.post('/admin/users', v);
      toast.success(r.message);
      if (r.tempPassword) setCreated(r); else navigate('/admin/users');
    }, { validate: (v) => { const er = {}; if (v.full_name.trim().length < 3) er.full_name = 'Enter the full name.'; if (!EMAIL.test(v.email)) er.email = 'Enter a valid email.'; if (!PHONE.test(v.phone)) er.phone = 'Use a Kenyan number, e.g. 0712345678.'; if (v.role === 'agent' && !/^[A-Za-z0-9/-]{4,30}$/.test(v.licence_no)) er.licence_no = 'Enter the licence number.'; return er; } });
  };

  if (loading) return <Loading />;
  if (loadError) return <Alert type="error">{loadError.message}</Alert>;
  return (
    <>
      <nav className="small muted mb-4"><Link to="/admin/users">Users</Link> / {id ? 'Edit' : 'Register'}</nav>
      <div className="page-head"><div><h1>{id ? `Edit ${form.values.full_name}` : 'Register a user'}</h1><p>{id ? 'Update contact details. Use the Users list to reset passwords or suspend.' : 'The user gets a temporary password by e-mail and must change it at first login.'}</p></div></div>
      <form className="card" style={{ maxWidth: 760 }} onSubmit={submit} noValidate>
        {form.message && <Alert type="error">{form.message}</Alert>}
        <div className="form-grid">
          <Field label="Role" name="role" required error={form.errors.role}>
            {id ? <input id="role" className="input" value={roleLabel(form.values.role)} disabled /> : <select className="select" {...form.bind('role')}>{roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select>}
          </Field>
          <Field label="Full name" name="full_name" required error={form.errors.full_name}><Input form={form} name="full_name" maxLength={100} /></Field>
          <Field label="Email" name="email" required error={form.errors.email}><Input form={form} name="email" type="email" maxLength={150} /></Field>
          <Field label="Phone" name="phone" required error={form.errors.phone}><Input form={form} name="phone" type="phone" maxLength={13} /></Field>
          {isAgent && <Field label="Licence number" name="licence_no" required error={form.errors.licence_no}><Input form={form} name="licence_no" maxLength={30} /></Field>}
          {isAgent && <Field label="Agency name" name="agency_name"><Input form={form} name="agency_name" maxLength={100} /></Field>}
        </div>
        {isAgent && !id && <p className="xsmall muted">Agents registered by an admin are approved immediately.</p>}
        <div className="row"><SubmitButton busy={form.submitting}>{id ? 'Save changes' : 'Create account'}</SubmitButton><Link to="/admin/users" className="btn btn-link">Cancel</Link></div>
      </form>
      {created && (
        <Modal title="Account created" onClose={() => navigate('/admin/users')} footer={<button className="btn btn-primary" onClick={() => navigate('/admin/users')}>Done</button>}>
          <p>{created.message}</p>
          <Alert type="success">Temporary password: <b className="temp-password">{created.tempPassword}</b></Alert>
          <p className="small muted mb-0">It was also e-mailed. The user must change it at first login.</p>
        </Modal>
      )}
    </>
  );
}
