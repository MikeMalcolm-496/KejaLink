/** Admin: review manual payment references and inspect M-Pesa payments. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, Loading, StatusBadge } from '../../components/ui';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import { fmtDateTime, money } from '../../utils/format';

export default function Payments() {
  useTitle('Payments');
  const [status, setStatus] = useState('');
  const { data, loading, reload } = useApi('/admin/payments', { status });
  const toast = useToast();
  const review = async (id, decision) => {
    try {
      const r = await api.patch(`/admin/payments/${id}`, { status: decision });
      toast.success(r.message);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <>
      <div className="page-head"><div><h1>Payments</h1><p>{data && <>Total received <b>{money(data.totalReceived)}</b> from {data.successful} successful payment(s). </>}<Link to="/admin/reports?type=payments">Payments report</Link></p></div></div>
      <div className="tabs">{[['', 'All'], ['success', 'Successful'], ['pending', 'Pending'], ['failed', 'Failed'], ['cancelled', 'Cancelled']].map(([k, t]) => <button key={k} className={`tab ${status === k ? 'active' : ''}`} onClick={() => setStatus(k)}>{t}</button>)}</div>
      <div className="card">
        {loading && !data ? <Loading /> : data.items.length === 0 ? <EmptyState icon="card" title="No payments found" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Date</th><th>Agent</th><th>Listing</th><th>Method</th><th className="num">Amount</th><th>Receipt / ref</th><th>Status</th><th>Review</th></tr></thead>
            <tbody>{data.items.map((r) => (
              <tr key={r.payment_id}><td className="small nowrap">{fmtDateTime(r.created_at)}</td><td>{r.agent}</td><td>{r.title || 'Deleted listing'}<div className="xsmall muted">{r.feature_days} days</div></td>
                <td>{r.payment_method === 'mpesa' ? 'M-Pesa' : 'Manual'}</td>
                <td className="num nowrap">{money(r.amount)}</td><td><code>{r.payment_reference || '-'}</code></td>
                <td><StatusBadge status={r.payment_status} />{r.result_desc && r.payment_status !== 'success' && <div className="xsmall muted">{r.result_desc}</div>}</td>
                <td>{r.payment_method === 'manual' && r.payment_status === 'pending' && <div className="req-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => review(r.payment_id, 'success')}>Confirm</button>
                  <button className="btn btn-danger btn-sm" onClick={() => review(r.payment_id, 'failed')}>Reject</button>
                </div>}</td></tr>))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
