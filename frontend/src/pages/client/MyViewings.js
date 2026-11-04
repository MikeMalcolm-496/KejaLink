/** Client: my viewings (upcoming and past), with cancel. */
import { useState } from 'react';
import Icon from '../../components/Icon';
import { Link } from 'react-router-dom';
import { EmptyState, Loading, LoadError, StatusBadge, useConfirm } from '../../components/ui';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import { coverUrl, dateParts, fmtDateTime, fmtTime } from '../../utils/format';

export default function MyViewings() {
  useTitle('My viewings');
  const [tab, setTab] = useState('upcoming');
  const { data, loading, error, reload } = useApi('/me/viewings', { tab });
  const [confirm, dialog] = useConfirm();
  const toast = useToast();

  const cancel = async (v) => {
    if (!(await confirm({ title: 'Cancel viewing?', text: `Cancel your viewing of ${v.title} on ${fmtDateTime(v.scheduled_at)}? The agent will be told and the slot freed.`, confirmText: 'Cancel viewing' }))) return;
    try { toast.success((await api.patch(`/me/viewings/${v.viewing_id}/cancel`)).message); reload(); } catch (err) { toast.error(err.message); }
  };

  return (
    <>
      <div className="page-head"><div><span className="eyebrow">Bookings</span><h1>My viewings</h1><p>Agents confirm, reschedule or decline requests, and you're notified each time.</p></div></div>
      <div className="tabs" role="tablist">
        {[['upcoming', 'Upcoming'], ['past', 'Past & closed']].map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{t}</button>)}
      </div>
      {error && <LoadError error={error} retry={reload} />}
      <div className="card">
        {loading ? <Loading /> : data.length === 0 ? (
          <EmptyState icon="calendar" title={tab === 'upcoming' ? 'No upcoming viewings' : 'No past viewings'} text="Open any listing and pick a free time to book a viewing." action={<Link className="btn btn-primary" to="/listings">Find a property</Link>} />
        ) : data.map((v) => {
          const d = dateParts(v.scheduled_at);
          return (
            <div className="req" key={v.viewing_id}>
              <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <div className="date-chip"><b>{d.day}</b><span>{d.month}</span></div>
                <img className="thumb" src={coverUrl(v.cover)} alt="" />
                <div>
                  <Link to={`/properties/${v.property_id}`} className="bold">{v.title}</Link>
                  <div className="small muted">{fmtTime(v.scheduled_at)} · {v.location}</div>
                  <div className="small">Agent: {v.agent_name} · <a href={`tel:${v.agent_phone}`}>{v.agent_phone}</a></div>
                  {v.address && <div className="small"><Icon name="pin" size={14} /> {v.address}</div>}
                  {v.agent_note && <div className="small muted"><em>Agent note: {v.agent_note}</em></div>}
                </div>
              </div>
              <div className="req-actions">
                <StatusBadge status={v.viewing_status} />
                {tab === 'upcoming' && <button className="btn btn-danger btn-sm" onClick={() => cancel(v)}>Cancel</button>}
              </div>
            </div>
          );
        })}
      </div>
      {dialog}
    </>
  );
}
