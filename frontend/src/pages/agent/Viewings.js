/** Agent: all viewing requests on own listings, with filters (FR4). */
import { useState } from 'react';
import ViewingActions from '../../components/ViewingActions';
import { EmptyState, Loading, LoadError, StatusBadge } from '../../components/ui';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import { dateParts, fmtTime, label } from '../../utils/format';

const STATUSES = ['requested', 'confirmed', 'rescheduled', 'declined', 'completed', 'cancelled'];

export default function Viewings() {
  useTitle('Viewing requests');
  const [when, setWhen] = useState('upcoming');
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useApi('/agent/viewings', { when, status });
  return (
    <>
      <div className="page-head"><div><h1>Viewing requests</h1><p>Confirm, reschedule or decline requests. Clients are notified instantly.</p></div></div>
      <div className="row-between mb-4">
        <div className="tabs mb-0">{[['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All dates']].map(([k, t]) => <button key={k} className={`tab ${when === k ? 'active' : ''}`} onClick={() => setWhen(k)}>{t}</button>)}</div>
        <div className="row"><label htmlFor="vstatus" className="small muted">Status</label>
          <select id="vstatus" className="select" style={{ width: 'auto', minHeight: 40 }} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
      </div>
      {error && <LoadError error={error} retry={reload} />}
      <div className="card">
        {loading && !data ? <Loading /> : data.length === 0 ? <EmptyState icon="calendar" title="No viewings here" text="Try another filter." /> : data.map((v) => {
          const d = dateParts(v.scheduled_at);
          return (
            <div className="req" key={v.viewing_id}>
              <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <div className="date-chip"><b>{d.day}</b><span>{d.month}</span></div>
                <div>
                  <div className="bold">{v.title}, {v.location}</div>
                  <div className="small muted">{fmtTime(v.scheduled_at)} · <StatusBadge status={v.viewing_status} /></div>
                  <div className="small">{v.client_name} · <a href={`tel:${v.client_phone}`}>{v.client_phone}</a> · <a href={`mailto:${v.client_email}`}>{v.client_email}</a></div>
                  {v.agent_note && <div className="small muted"><em>Note: {v.agent_note}</em></div>}
                </div>
              </div>
              <ViewingActions viewing={v} onDone={reload} />
            </div>
          );
        })}
      </div>
    </>
  );
}
