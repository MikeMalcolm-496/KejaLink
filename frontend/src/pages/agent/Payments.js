/** Agent: feature a listing with M-Pesa or a manual payment reference. */
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

function Waiting({ paymentId, amount, phone, onFinished }) {
  const [note, setNote] = useState('Waiting for confirmation…');
  const tries = useRef(0);

  useEffect(() => {
    let timer;
    let active = true;
    const check = async () => {
      tries.current += 1;
      try {
        const result = await api.get(`/payments/${paymentId}`);
        if (result.status !== 'pending') {
          if (active) onFinished(result);
          return;
        }
      } catch {
        // Continue polling through temporary connection errors.
      }
      if (active && tries.current < 40) timer = setTimeout(check, 3000);
      else if (active) setNote('Still waiting. If you completed the payment, refresh this page in a minute.');
    };
    timer = setTimeout(check, 3000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [paymentId, onFinished]);

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
  useTitle('Featuring & payments');
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const { data, loading, reload } = useApi('/payments');
  const form = useForm({
    property_id: params.get('property_id') || '',
    days: '7',
    phone: user.phone,
    reference: '',
  });
  const [method, setMethod] = useState('mpesa');
  const [waiting, setWaiting] = useState(null);
  const approved = user.verification_status === 'approved';

  const pay = (event) => {
    event.preventDefault();
    form.submit(async (values) => {
      const result = await api.post('/payments', { ...values, method });
      if (method === 'mpesa') {
        setWaiting({ id: result.payment_id, amount: data.packages[values.days], phone: values.phone });
        return;
      }
      toast.success(result.message);
      form.set('reference', '');
      reload();
    }, {
      validate: (values) => {
        const errors = {};
        if (!values.property_id) errors.property_id = 'Choose a listing.';
        if (method === 'mpesa' && !PHONE.test(values.phone)) {
          errors.phone = 'Enter the Safaricom number that will pay, e.g. 0712345678.';
        }
        if (method === 'manual' && values.reference.trim().length < 3) {
          errors.reference = 'Enter a payment reference of at least 3 characters.';
        }
        return errors;
      },
    });
  };

  const finished = (result) => {
    setWaiting(null);
    if (result.status === 'success') {
      toast.success(`Payment received${result.receipt ? ` (receipt ${result.receipt})` : ''}. Your listing is now featured.`);
    } else {
      toast.error(`Payment ${result.status}: ${result.desc || 'No payment was confirmed.'}`);
    }
    reload();
  };

  if (loading && !data) return <Loading />;
  return (
    <>
      <div className="page-head"><div><h1>Feature a listing</h1><p>Featured listings appear first in every search, with a star badge.</p></div></div>
      <VerificationBanner user={user} />
      {data.simulated && (
        <Alert type="info">
          <b>Demo mode:</b> M-Pesa is simulated, so no real money moves. It completes about 5 seconds after the request.
          Use <code>0700000000</code> to simulate cancellation.
        </Alert>
      )}
      <div className="grid-2">
        <div className="card">
          {waiting ? (
            <Waiting paymentId={waiting.id} amount={waiting.amount} phone={waiting.phone} onFinished={finished} />
          ) : (
            <form onSubmit={pay} noValidate>
              <div className="tabs mb-4">
                <button type="button" className={`tab ${method === 'mpesa' ? 'active' : ''}`} onClick={() => setMethod('mpesa')}>M-Pesa</button>
                <button type="button" className={`tab ${method === 'manual' ? 'active' : ''}`} onClick={() => setMethod('manual')}>Manual reference</button>
              </div>
              {form.message && <Alert type="error">{form.message}</Alert>}
              {data.listings.length === 0 ? <p className="muted">You need an active listing first.</p> : <>
                <Field label="Listing" name="property_id" required error={form.errors.property_id}>
                  <select className="select" {...form.bind('property_id')}>
                    <option value="">Choose a listing…</option>
                    {data.listings.map((listing) => (
                      <option key={listing.property_id} value={listing.property_id}>
                        {listing.title}{isFeatured(listing) ? ` (featured to ${fmtDate(listing.featured_until)})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <fieldset style={{ border: 0, padding: 0, margin: '0 0 16px' }}>
                  <legend className="small bold mb-2">Package</legend>
                  <div className="role-picker">
                    {Object.entries(data.packages).map(([days, amount]) => (
                      <label key={days} className="role-option">
                        <input type="radio" name="days" value={days} checked={form.values.days === days} onChange={() => form.set('days', days)} />
                        <Icon name="star" />
                        <span><b>{days} days</b><br /><span className="small muted">{money(amount)}</span></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {method === 'mpesa' ? (
                  <>
                    <Field label="M-Pesa phone number" name="phone" required error={form.errors.phone} hint="You'll get a PIN prompt on this phone.">
                      <Input form={form} name="phone" type="tel" maxLength={13} />
                    </Field>
                    <SubmitButton busy={form.submitting} disabled={!approved} className="btn btn-block" style={{ background: '#2e9d3a', color: '#fff' }} busyText="Sending request to your phone…">
                      <Icon name="mobile" />Pay with M-Pesa
                    </SubmitButton>
                  </>
                ) : (
                  <>
                    <p className="small muted">Pay through your agreed offline arrangement, then submit its reference. An administrator verifies it before featuring your listing.</p>
                    <Field label="Payment reference" name="reference" required error={form.errors.reference} hint="Enter the transaction reference or a note identifying your payment.">
                      <Input form={form} name="reference" maxLength={100} />
                    </Field>
                    <SubmitButton busy={form.submitting} disabled={!approved} className="btn btn-primary btn-block" busyText="Submitting…">
                      <Icon name="card" />Submit for review
                    </SubmitButton>
                  </>
                )}
              </>}
            </form>
          )}
        </div>
        <div className="card">
          <h2 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>Payment history</h2>
          {data.history.length === 0 ? <EmptyState icon="card" title="No payments yet" /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Date</th><th>Listing</th><th className="num">Amount</th><th>Method</th><th>Receipt / ref</th><th>Status</th></tr></thead>
              <tbody>{data.history.map((payment) => (
                <tr key={payment.payment_id}>
                  <td className="nowrap small">{fmtDateTime(payment.created_at)}</td>
                  <td>{payment.title || 'Deleted listing'}<div className="xsmall muted">{payment.feature_days} days</div></td>
                  <td className="num nowrap">{money(payment.amount)}</td>
                  <td>{payment.payment_method === 'mpesa' ? 'M-Pesa' : 'Manual'}</td>
                  <td><code>{payment.payment_reference || '-'}</code></td>
                  <td><StatusBadge status={payment.payment_status} /></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      </div>
    </>
  );
}
