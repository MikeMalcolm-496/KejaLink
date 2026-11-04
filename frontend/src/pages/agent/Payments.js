/** Agent: submit a manual payment for featuring a listing, plus payment history. */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import VerificationBanner from '../../components/VerificationBanner';
import { Alert, EmptyState, Field, Input, Loading, StatusBadge, SubmitButton } from '../../components/ui';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import useForm from '../../hooks/useForm';
import useTitle from '../../hooks/useTitle';
import { fmtDate, fmtDateTime, isFeatured, money } from '../../utils/format';

export default function Payments() {
  useTitle('Featuring & payments');
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const { data, loading, reload } = useApi('/payments');
  const form = useForm({ property_id: params.get('property_id') || '', days: '7', reference: '' });
  const approved = user.verification_status === 'approved';

  const pay = (e) => {
    e.preventDefault();
    form.submit(async (v) => {
      const r = await api.post('/payments', v);
      toast.success(r.message);
      form.set('reference', '');
      reload();
    }, { validate: (v) => { const er = {}; if (!v.property_id) er.property_id = 'Choose a listing.'; if (v.reference.trim().length < 3) er.reference = 'Enter a payment reference of at least 3 characters.'; return er; } });
  };

  if (loading && !data) return <Loading />;
  return (
    <>
      <div className="page-head"><div><h1>Feature a listing</h1><p>Featured listings appear first in every search, with a star badge.</p></div></div>
      <VerificationBanner user={user} />
      <div className="grid-2">
        <div className="card">
          <form onSubmit={pay} noValidate>
            <h2 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>Manual payment</h2>
            <p className="small muted">Use your agreed offline payment arrangement, then submit its reference for an administrator to verify. No online payment is taken here; your listing is featured after approval.</p>
            {form.message && <Alert type="error">{form.message}</Alert>}
            {data.listings.length === 0 ? <p className="muted">You need an active listing first.</p> : <>
              <Field label="Listing" name="property_id" required error={form.errors.property_id}>
                <select className="select" {...form.bind('property_id')}><option value="">Choose a listing…</option>
                  {data.listings.map((l) => <option key={l.property_id} value={l.property_id}>{l.title}{isFeatured(l) ? ` (featured to ${fmtDate(l.featured_until)})` : ''}</option>)}</select>
              </Field>
              <fieldset style={{ border: 0, padding: 0, margin: '0 0 16px' }}>
                <legend className="small bold mb-2">Package</legend>
                <div className="role-picker">
                  {Object.entries(data.packages).map(([days, amount]) => (
                    <label key={days} className="role-option"><input type="radio" name="days" value={days} checked={form.values.days === days} onChange={() => form.set('days', days)} />
                      <Icon name="star" /><span><b>{days} days</b><br /><span className="small muted">{money(amount)}</span></span></label>
                  ))}
                </div>
              </fieldset>
              <Field label="Payment reference" name="reference" required error={form.errors.reference} hint="Enter the transaction reference or a note identifying your payment.">
                <Input form={form} name="reference" maxLength={100} />
              </Field>
              <SubmitButton busy={form.submitting} disabled={!approved} className="btn btn-primary btn-block" busyText="Submitting…"><Icon name="card" />Submit for review</SubmitButton>
            </>}
          </form>
        </div>
        <div className="card">
          <h2 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>Payment history</h2>
          {data.history.length === 0 ? <EmptyState icon="card" title="No payments yet" /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Date</th><th>Listing</th><th className="num">Amount</th><th>Method</th><th>Reference</th><th>Status</th></tr></thead>
              <tbody>{data.history.map((h) => (
                <tr key={h.payment_id}><td className="nowrap small">{fmtDateTime(h.created_at)}</td><td>{h.title || 'Deleted listing'}<div className="xsmall muted">{h.feature_days} days</div></td>
                  <td className="num nowrap">{money(h.amount)}</td><td>{h.payment_method === 'manual' ? 'Manual' : 'Legacy'}</td>
                  <td><code>{h.payment_reference || '-'}</code></td><td><StatusBadge status={h.payment_status} /></td></tr>))}</tbody>
            </table></div>
          )}
        </div>
      </div>
    </>
  );
}
