/** Admin: all listings, client reports, remove / restore (FR5). */
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { EmptyState, Loading, LoadError, Pagination, SortHeader, StatusBadge } from '../../components/ui';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import useAdminAction from './useAdminAction';
import { coverUrl, fmtDate, label, priceLabel } from '../../utils/format';

export default function Listings() {
  useTitle('Listings');
  const [params] = useSearchParams();
  const [f, setF] = useState({ q: params.get('q') || '', status: '', reported: params.get('reported') === '1' ? '1' : '', sort: '', dir: 'desc', page: 1 });
  const [q, setQ] = useState(f.q);
  const { data, loading, error, reload } = useApi('/admin/listings', f);
  const act = useAdminAction(reload);
  const set = (c) => setF((x) => ({ ...x, page: 1, ...c }));
  const sortProps = { sort: f.sort, dir: f.dir, onSort: (sort, dir) => set({ sort, dir }) };
  return (
    <>
      <div className="page-head"><div><h1>Listings</h1><p>{data ? `${data.total} listings. ` : ''}Remove listings that break the rules; agents are told your reason.</p></div></div>
      <form className="card filters mb-6" onSubmit={(e) => { e.preventDefault(); set({ q }); }}>
        <div className="field"><label htmlFor="lq">Search</label><input id="lq" className="input" placeholder="Title, location or agent" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="field"><label htmlFor="lstatus">Status</label><select id="lstatus" className="select" value={f.status} onChange={(e) => set({ status: e.target.value })}><option value="">All</option>{['available', 'under_offer', 'sold', 'rented', 'removed'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
        <label className="check" style={{ alignSelf: 'center' }}><input type="checkbox" checked={f.reported === '1'} onChange={(e) => set({ reported: e.target.checked ? '1' : '' })} />Reported only</label>
        <button className="btn btn-primary">Filter</button>
      </form>
      {error && <LoadError error={error} retry={reload} />}
      <div className="card">
        {loading && !data ? <Loading /> : data.items.length === 0 ? <EmptyState icon="building" title="No listings found" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th /><SortHeader field="title" {...sortProps}>Listing</SortHeader><SortHeader field="agent" {...sortProps}>Agent</SortHeader><SortHeader field="price" {...sortProps}>Price</SortHeader>
              <SortHeader field="status" {...sortProps}>Status</SortHeader><SortHeader field="views" {...sortProps}>Views</SortHeader><SortHeader field="reports" {...sortProps}>Reports</SortHeader><th>Actions</th></tr></thead>
            <tbody>{data.items.map((p) => (
              <tr key={p.property_id}>
                <td><img className="thumb" src={coverUrl(p.cover)} alt="" /></td>
                <td><Link to={`/properties/${p.property_id}`} className="bold">{p.title}</Link><div className="xsmall muted">{p.location} · listed {fmtDate(p.created_at)}</div>
                  {p.open_reports.map((r) => (
                    <div key={r.report_id} className="small mt-2" style={{ color: 'var(--danger)' }}><Icon name="flag" size={13} /> "{r.reason}" by {r.reporter}{' '}
                      <button className="btn-link xsmall" onClick={() => act.run('resolve_report', { report_id: r.report_id }).catch(() => {})}>Dismiss</button></div>
                  ))}</td>
                <td className="small">{p.agent_name}</td><td className="nowrap">{priceLabel(p)}</td><td><StatusBadge status={p.listing_status} /></td><td className="num">{p.views_count}</td>
                <td>{p.reports ? <span className="badge tone-bad">{p.reports}</span> : 0}</td>
                <td>{p.listing_status === 'removed'
                  ? <button className="btn btn-outline btn-sm" onClick={() => act.withConfirm('restore_listing', { property_id: p.property_id }, { title: 'Restore listing?', text: 'Clients will be able to see it again.', confirmText: 'Restore', tone: 'primary' })}>Restore</button>
                  : <button className="btn btn-danger btn-sm" onClick={() => act.withReason('remove_listing', { property_id: p.property_id }, `Remove ${p.title}`, 'The listing is hidden, its upcoming viewings are cancelled, and the agent is told your reason.')}>Remove</button>}</td>
              </tr>))}</tbody>
          </table></div>
        )}
        {data && <Pagination page={data.page} pages={data.pages} onChange={(page) => setF({ ...f, page })} />}
      </div>
      {act.dialogs}
    </>
  );
}
