/** Agent: browse, search, sort, change status and delete own listings (FR2). */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import VerificationBanner from '../../components/VerificationBanner';
import { EmptyState, Loading, LoadError, Pagination, SortHeader, StatusBadge, useConfirm } from '../../components/ui';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import { LISTING_STATUSES, PROPERTY_TYPES, coverUrl, fmtDate, isFeatured, label, priceLabel } from '../../utils/format';

export default function Listings() {
  useTitle('My listings');
  const { user } = useAuth();
  const toast = useToast();
  const approved = user.verification_status === 'approved';
  const [filters, setFilters] = useState({ q: '', status: '', sort: 'created', dir: 'desc', page: 1 });
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useApi('/agent/listings', filters);
  const [confirm, dialog] = useConfirm();

  const set = (changes) => setFilters((f) => ({ ...f, page: 1, ...changes }));
  const changeStatus = async (p, status) => {
    try { toast.success((await api.patch(`/agent/listings/${p.property_id}/status`, { status })).message); reload(); } catch (err) { toast.error(err.message); }
  };
  const remove = async (p) => {
    if (!(await confirm({ title: 'Delete listing?', text: `Delete "${p.title}"? Its photos, viewings and inquiries will also be deleted. This cannot be undone.`, confirmText: 'Delete listing' }))) return;
    try { toast.success((await api.delete(`/agent/listings/${p.property_id}`)).message); reload(); } catch (err) { toast.error(err.message); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>My listings</h1><p>{data ? `${data.total} listing${data.total === 1 ? '' : 's'}` : ' '}</p></div>
        {approved && <Link to="/agent/listings/new" className="btn btn-primary"><Icon name="plus" />Add new listing</Link>}
      </div>
      <VerificationBanner user={user} />
      <form className="card filters mb-6" onSubmit={(e) => { e.preventDefault(); set({ q: search }); }}>
        <div className="field"><label htmlFor="q">Search</label><input id="q" className="input" placeholder="Title or location" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="field"><label htmlFor="status">Status</label>
          <select id="status" className="select" value={filters.status} onChange={(e) => set({ status: e.target.value })}><option value="">All</option>{Object.entries({ ...LISTING_STATUSES, removed: 'Removed by admin' }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <button className="btn btn-primary">Search</button>
      </form>
      {error && <LoadError error={error} retry={reload} />}
      <div className="card">
        {loading && !data ? <Loading /> : data.items.length === 0 ? <EmptyState icon="building" title="No listings found" text={filters.q || filters.status ? 'Try clearing the filters.' : 'Add your first listing to get started.'} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th /><SortHeader field="title" {...filters} onSort={(sort, dir) => set({ sort, dir })}>Property</SortHeader>
              <SortHeader field="price" {...filters} onSort={(sort, dir) => set({ sort, dir })}>Price</SortHeader>
              <SortHeader field="status" {...filters} onSort={(sort, dir) => set({ sort, dir })}>Status</SortHeader>
              <SortHeader field="views" {...filters} onSort={(sort, dir) => set({ sort, dir })}>Views</SortHeader>
              <th>Viewings / inquiries</th><SortHeader field="created" {...filters} onSort={(sort, dir) => set({ sort, dir })}>Listed</SortHeader><th /></tr></thead>
            <tbody>{data.items.map((p) => (
              <tr key={p.property_id}>
                <td><img className="thumb" src={coverUrl(p.cover)} alt="" /></td>
                <td><Link to={`/properties/${p.property_id}`} className="bold">{p.title}</Link>
                  <div className="xsmall muted">{p.location} · {label(p.listing_type)} · {PROPERTY_TYPES[p.property_type]}{isFeatured(p) && <b style={{ color: 'var(--amber-ink)' }}> · ★ Featured to {fmtDate(p.featured_until)}</b>}</div></td>
                <td className="nowrap">{priceLabel(p)}</td>
                <td>{p.listing_status === 'removed' || !approved ? <StatusBadge status={p.listing_status} /> : (
                  <select className="select" style={{ minHeight: 36, minWidth: 130 }} aria-label={`Status of ${p.title}`} value={p.listing_status} onChange={(e) => changeStatus(p, e.target.value)}>
                    {Object.entries(LISTING_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>)}</td>
                <td className="num">{p.views_count}</td>
                <td>{p.viewings} / {p.inquiries}</td>
                <td className="nowrap small">{fmtDate(p.created_at)}</td>
                <td>{approved && p.listing_status !== 'removed' && (
                  <div className="req-actions" style={{ flexWrap: 'nowrap' }}>
                    <Link to={`/agent/listings/${p.property_id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
                    <Link to={`/agent/payments?property_id=${p.property_id}`} className="btn btn-ghost btn-sm" title="Feature with M-Pesa" aria-label={`Feature ${p.title}`}><Icon name="star" size={16} /></Link>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>Delete</button>
                  </div>)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
        {data && <Pagination page={data.page} pages={data.pages} onChange={(page) => setFilters({ ...filters, page })} />}
      </div>
      {dialog}
    </>
  );
}
