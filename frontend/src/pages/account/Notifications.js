/** All notifications. */
import { useNavigate } from 'react-router-dom';
import { EmptyState, Loading } from '../../components/ui';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import { fmtDateTime } from '../../utils/format';

export default function Notifications() {
  useTitle('Notifications');
  const { setUnread } = useAuth();
  const navigate = useNavigate();
  const { data, loading, reload } = useApi('/me/notifications', { limit: 100 });
  const readAll = async () => { await api.post('/me/notifications/read'); setUnread(0); reload(); };
  const open = async (n) => { await api.post('/me/notifications/read', { id: n.notification_id }); if (n.link) navigate(n.link); else reload(); };
  return (
    <>
      <div className="page-head"><div><h1>Notifications</h1><p>Updates about your viewings, inquiries and account.</p></div>
        {data && data.unread > 0 && <button className="btn btn-ghost" onClick={readAll}>Mark all as read</button>}</div>
      <div className="card">
        {loading ? <Loading /> : data.items.length === 0 ? <EmptyState icon="bell" title="No notifications yet" /> : (
          <ul className="timeline">
            {data.items.map((n) => (
              <li key={n.notification_id} style={{ opacity: n.is_read ? 0.7 : 1 }}>
                <div><button className="btn-link" style={{ textDecoration: 'none', color: 'var(--ink)', fontWeight: n.is_read ? 400 : 600, textAlign: 'left' }} onClick={() => open(n)}>{n.message}</button>
                  <div className="xsmall muted">{fmtDateTime(n.created_at)}</div></div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
