/** Agent: feature a listing by paying with M-Pesa (STK Push), plus payment history. */
import { useEffect, useRef, useState } from 'react';
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
import { PHONE } from '../../utils/validation';

/** Polls the server every 3 s until M-Pesa reports success, failure or cancellation (max 2 minutes). */
function Waiting({ paymentId, amount, phone, onFinished }) {
  const [note, setNote] = useState('Waiting for confirmation…');
  const tries = useRef(0);
  useEffect(() => {
    let timer;
    const check = async () => {
      tries.current += 1;
      try {
        const r = await api.get(`/payments/${paymentId}`);
        if (r.status !== 'pending') { onFinished(r); return; }
      } catch { /* network blip: keep trying */ }
      if (tries.current < 40) timer = setTimeout(check, 3000);
      else setNote('Still waiting. If you completed the payment, refresh this page in a minute.');
    };
    timer = setTimeout(check, 3000);
    return () => clearTimeout(timer);
  }, [paymentId]);
  return (
    <div className="mpesa-wait" role="status">
      <div className="mpesa-brand">M-PESA</div>
      <div className="pulse"><Icon name="mobile" size={28} /></div>
      <h2 style={{ fontSize: 'var(--text-lg)' }}>Check your phone</h2>
      <p className="muted">Enter your M-Pesa PIN on <b>{phone}</b> to pay <b>{money(amount)}</b>.</p>
      <p className="small muted mb-0">{note}</p>
    </div>
  );
}

export default function Payments() {
  useTitle('Featuring & M-Pesa');
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const { data, loading, reload } = useApi('/payments');
  const form = useForm({ property_id: params.get('property_id') || '', days: '7', phone: user.phone });
  const [waiting, setWaiting] = useState(null);
  const approved = user.verification_status === 'approved';

  const pay = (e) => {
    e.preventDefault();
    form.submit(async (v) => {
      const r = await api.post('/payments', v);
      setWaiting({ id: r.payment_id, amount: data.packages[v.days], phone: v.phone });
    }, { validate: (v) => { const er = {}; if (!v.property_id) er.property_id = 'Choose a listing.'; if (!PHONE.test(v.phone)) er.phone = 'Enter the Safaricom number that will pay, e.g. 0712345678.'; return er; } });
  };
  const finished = (r) => {
    setWaiting(null);
    if (r.status === 'success') toast.success(`Payment received (receipt ${r.receipt}). Your listing is now featured.`);
    else toast.error(`Payment ${r.status}: ${r.desc}. No money was taken.`);
    reload();
  };

  if (loading && !data) return <Loading />;
  return (
    <>
      <div className="page-head"><div><h1>Feature a listing</h1><p>Featured listings appear first in every search, with a star badge.</p></div></div>
      <VerificationBanner user={user} />
      {data.simulated && <Alert type="info"><b>Demo mode:</b> M-Pesa is simulated, so no real money moves. The payment completes 5 seconds after you confirm. Use <code>0700000000</code> to simulate a cancelled payment. Set <code>MPESA_ENV=sandbox</code> in the backend .env for Safaricom's test system.</Alert>}
      <div className="grid-2">
        <div className="card">
          {waiting ? <Waiting paymentId={waiting.id} amount={waiting.amount} phone={waiting.phone} onFinished={finished} /> : (
            <form onSubmit={pay} noValidate>
              <h2 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>Pay with M-Pesa</h2>
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
                <Field label="M-Pesa phone number" name="phone" required error={form.errors.phone} hint="You'll get a PIN prompt on this phone."><Input form={form} name="phone" type="phone" maxLength={13} /></Field>
                <SubmitButton busy={form.submitting} disabled={!approved} className="btn btn-block" style={{ background: '#2e9d3a', color: '#fff' }} busyText="Sending request to your phone…"><Icon name="mobile" />Pay with M-Pesa</SubmitButton>
              </>}
            </form>
          )}
        </div>
        <div className="card">
          <h2 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>Payment history</h2>
          {data.history.length === 0 ? <EmptyState icon="card" title="No payments yet" /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Date</th><th>Listing</th><th className="num">Amount</th><th>Receipt</th><th>Status</th></tr></thead>
              <tbody>{data.history.map((h) => (
                <tr key={h.payment_id}><td className="nowrap small">{fmtDateTime(h.created_at)}</td><td>{h.title || 'Deleted listing'}<div className="xsmall muted">{h.feature_days} days</div></td>
                  <td className="num nowrap">{money(h.amount)}</td><td><code>{h.mpesa_receipt || '-'}</code></td><td><StatusBadge status={h.payment_status} /></td></tr>))}</tbody>
            </table></div>
          )}
        </div>
      </div>
    </>
  );
}
