/**
 * HeaderMenus: the notifications bell and the user menu, shared by the
 * public header and the panel top bar.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { roleLabel, timeAgo } from '../utils/format';

/** Close a dropdown when clicking outside it or pressing Escape. */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

export function NotificationBell() {
  const { unread, setUnread } = useAuth();
  const { open, setOpen, ref } = useDropdown();
  const [items, setItems] = useState([]);
  const navigate = useNavigate();

  const toggle = async () => {
    setOpen(!open);
    if (!open) {
      const data = await api.get('/me/notifications', { limit: 6 }).catch(() => ({ items: [], unread }));
      setItems(data.items);
      setUnread(data.unread);
    }
  };
  const openItem = async (n) => {
    setOpen(false);
    if (!n.is_read) {
      await api.post('/me/notifications/read', { id: n.notification_id }).catch(() => {});
      setUnread(Math.max(0, unread - 1));
    }
    if (n.link) navigate(n.link);
  };
  const readAll = async () => {
    await api.post('/me/notifications/read');
    setUnread(0);
    setItems((list) => list.map((n) => ({ ...n, is_read: true })));
  };

  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn" onClick={toggle} aria-expanded={open} aria-label={`Notifications, ${unread} unread`}>
        <Icon name="bell" />
        {unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="dropdown-menu notif-menu">
          <div className="row-between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
            <strong>Notifications</strong>
            {unread > 0 && <button className="btn-link small" onClick={readAll}>Mark all read</button>}
          </div>
          {items.length === 0 && <p className="muted small" style={{ padding: 20, textAlign: 'center', margin: 0 }}>You're all caught up.</p>}
          {items.map((n) => (
            <button key={n.notification_id} className={`notif-item ${n.is_read ? '' : 'unread'}`} onClick={() => openItem(n)}>
              <div>{n.message}</div>
              <div className="xsmall muted" style={{ fontWeight: 400 }}>{timeAgo(n.created_at)}</div>
            </button>
          ))}
          <Link to="/account/notifications" className="notif-item" style={{ textAlign: 'center', fontWeight: 600 }} onClick={() => setOpen(false)}>See all notifications</Link>
        </div>
      )}
    </div>
  );
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const { open, setOpen, ref } = useDropdown();
  const navigate = useNavigate();
  const doLogout = async () => { setOpen(false); await logout(); navigate('/login', { state: { message: 'You have been logged out.' } }); };
  return (
    <div className="dropdown" ref={ref}>
      <button className="user-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        <span className="avatar">{user.full_name.charAt(0).toUpperCase()}</span>
        <span className="hide-sm">{user.full_name.split(' ')[0]}</span>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <div className="dropdown-menu" role="menu" onClick={() => setOpen(false)}>
          <div className="dropdown-head"><strong>{user.full_name}</strong><div className="xsmall muted">{roleLabel(user.role)} · {user.email}</div></div>
          <Link to="/account/profile" role="menuitem"><Icon name="user" />Profile</Link>
          <Link to="/account/security" role="menuitem"><Icon name="shield" />Password &amp; 2FA</Link>
          <Link to="/account/notifications" role="menuitem"><Icon name="bell" />Notifications</Link>
          <Link to="/help" role="menuitem"><Icon name="help" />Help centre</Link>
          <button className="item" role="menuitem" onClick={doLogout} style={{ color: 'var(--danger)' }}><Icon name="logout" />Log out</button>
        </div>
      )}
    </div>
  );
}
