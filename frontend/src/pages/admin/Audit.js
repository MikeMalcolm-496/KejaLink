/** Admin: activity log (audit trail): who did what, when and from which IP. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { EmptyState, Loading, LoadError, Pagination } from '../../components/ui';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import { label, roleLabel } from '../../utils/format';

const BAD = /failed|locked|denied|csrf/;

export default function Audit() {
  useTitle('Activity log');
  const [f, setF] = useState({ q: '', action: '', from: '', to: '', page: 1 });
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useApi('/admin/audit', f);
  const set = (c) => setF((x) => ({ ...x, page: 1, ...c }));
  return (
    <>
      <div className="page-head">
        <div><h1>Activity log</h1><p>{data ? `${data.total.toLocaleString()} events. ` : ''}Entries cannot be edited or deleted from the system.</p></div>
        <Link className="btn btn-ghost" to={`/admin/reports?type=audit&from=${f.from}&to=${f.to}&location=${encodeURIComponent(f.q)}`}><Icon name="download" size={16} />Export as report</Link>
      </div>
      <form className="card filters mb-6" onSubmit={(e) => { e.preventDefault(); set({ q }); }}>
        <div className="field"><label htmlFor="aq">Search</label><input id="aq" className="input" placeholder="User, detail or IP" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="field"><label htmlFor="aa">Action</label><select id="aa" className="select" value={f.action} onChange={(e) => set({ action: e.target.value })}><option value="">All actions</option>{(data ? data.actions : []).map((a) => <option key={a} value={a}>{label(a)}</option>)}</select></div>
        <div className="field"><label htmlFor="af">From</label><input id="af" type="date" className="input" value={f.from} onChange={(e) => set({ from: e.target.value })} /></div>
        <div className="field"><label htmlFor="at">To</label><input id="at" type="date" className="input" value={f.to} onChange={(e) => set({ to: e.target.value })} /></div>
        <button className="btn btn-primary">Filter</button>
      </form>
      {error && <LoadError error={error} retry={reload} />}
      <div className="card">
        {loading && !data ? <Loading /> : data.items.length === 0 ? <EmptyState icon="history" title="No activity matches" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>When</th><th>User</th><th>Action</th><th>Record</th><th>Details</th><th>IP address</th></tr></thead>
            <tbody>{data.items.map((l) => (
              <tr key={l.log_id}>
                <td className="nowrap small">{new Date(l.created_at).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' })}</td>
                <td className="small">{l.full_name || 'Guest'}{l.role && <div className="muted">{roleLabel(l.role)}</div>}</td>
                <td className="small bold" style={{ color: BAD.test(l.action) ? 'var(--danger)' : undefined }}>{label(l.action)}</td>
                <td className="small muted">{l.entity_type}{l.entity_id ? ` #${l.entity_id}` : ''}</td>
                <td className="small">{l.details}</td>
                <td className="small muted" title={l.user_agent}>{l.ip_address}</td>
              </tr>))}</tbody>
          </table></div>
        )}
        {data && <Pagination page={data.page} pages={data.pages} onChange={(page) => setF({ ...f, page })} />}
      </div>
    </>
  );
}
