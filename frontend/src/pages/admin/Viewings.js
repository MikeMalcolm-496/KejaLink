/** Admin: all viewings on the platform (read-only oversight). */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, Loading, LoadError, Pagination, SortHeader, StatusBadge } from '../../components/ui';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import { fmtDate, fmtDateTime, label } from '../../utils/format';

export default function Viewings() {
  useTitle('Viewings');
  const [f, setF] = useState({ q: '', status: '', from: '', to: '', sort: 'date', dir: 'desc', page: 1 });
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useApi('/admin/viewings', f);
  const set = (c) => setF((x) => ({ ...x, page: 1, ...c }));
  const sp = { sort: f.sort, dir: f.dir, onSort: (sort, dir) => set({ sort, dir }) };
  return (
    <>
      <div className="page-head"><div><h1>Viewings</h1><p>{data ? `${data.total} viewings. ` : ''}Agents and clients manage their own bookings; this view is for oversight.</p></div></div>
      <form className="card filters mb-6" onSubmit={(e) => { e.preventDefault(); set({ q }); }}>
        <div className="field"><label htmlFor="vq">Search</label><input id="vq" className="input" placeholder="Property, client or agent" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="field"><label htmlFor="vs">Status</label><select id="vs" className="select" value={f.status} onChange={(e) => set({ status: e.target.value })}><option value="">All</option>{['requested', 'confirmed', 'rescheduled', 'declined', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
        <div className="field"><label htmlFor="vf">From</label><input id="vf" type="date" className="input" value={f.from} onChange={(e) => set({ from: e.target.value })} /></div>
        <div className="field"><label htmlFor="vt">To</label><input id="vt" type="date" className="input" value={f.to} onChange={(e) => set({ to: e.target.value })} /></div>
        <button className="btn btn-primary">Filter</button>
      </form>
      {error && <LoadError error={error} retry={reload} />}
      <div className="card">
        {loading && !data ? <Loading /> : data.items.length === 0 ? <EmptyState icon="calendar" title="No viewings found" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><SortHeader field="date" {...sp}>Date &amp; time</SortHeader><SortHeader field="property" {...sp}>Property</SortHeader><SortHeader field="client" {...sp}>Client</SortHeader><SortHeader field="agent" {...sp}>Agent</SortHeader><SortHeader field="status" {...sp}>Status</SortHeader><SortHeader field="booked" {...sp}>Booked</SortHeader></tr></thead>
            <tbody>{data.items.map((v) => (
              <tr key={v.viewing_id}><td className="nowrap small">{fmtDateTime(v.scheduled_at)}</td><td><Link to={`/properties/${v.property_id}`}>{v.title}</Link></td><td>{v.client}</td><td>{v.agent}</td>
                <td><StatusBadge status={v.viewing_status} />{v.agent_note && <div className="xsmall muted">{v.agent_note}</div>}</td><td className="small">{fmtDate(v.created_at)}</td></tr>))}</tbody>
          </table></div>
        )}
        {data && <Pagination page={data.page} pages={data.pages} onChange={(page) => setF({ ...f, page })} />}
      </div>
    </>
  );
}
