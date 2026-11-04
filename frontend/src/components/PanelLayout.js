/**
 * PanelLayout: the frame for the agent portal and admin panel
 * (side navigation + top bar). area = 'agent' | 'admin'.
 */
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import Icon from './Icon';
import { NotificationBell, UserMenu } from './HeaderMenus';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const MENUS = {
  agent: [
    ['/agent', 'gauge', 'Dashboard'],
    ['/agent/listings', 'building', 'My listings'],
    ['/agent/viewings', 'calendar', 'Viewing requests'],
    ['/agent/inquiries', 'message', 'Inquiries'],
    ['/agent/payments', 'card', 'Featuring & payments'],
    ['/agent/reports', 'file', 'Reports'],
    ['/account/profile', 'user', 'Profile'],
  ],
  admin: [
    ['/admin', 'gauge', 'Overview'],
    ['/admin/agents', 'id', 'Agent verification'],
    ['/admin/users', 'users', 'Users'],
    ['/admin/listings', 'building', 'Listings'],
    ['/admin/viewings', 'calendar', 'Viewings'],
    ['/admin/payments', 'card', 'Payments'],
    ['/admin/reports', 'file', 'Reports'],
    ['/admin/audit', 'history', 'Activity log'],
  ],
};

export default function PanelLayout({ area, help }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});
  useEffect(() => {
    setOpen(false);
    api.get('/me/badges').then(setCounts).catch(() => {});   // refresh the sidebar counts on every page change
  }, [location.pathname]);

  const menu = [...MENUS[area]];
  if (area === 'admin' && user.role === 'super_admin') menu.push(['/admin/admins', 'shield', 'Administrators']);
  const roleText = area === 'agent' ? 'AGENT PORTAL' : user.role === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN PANEL';
  const doLogout = async () => { await logout(); navigate('/login', { state: { message: 'You have been logged out.' } }); };

  return (
    <div className={`panel-shell panel-${area}`}>
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label={`${area} navigation`}>
        <div className="sidebar-head"><Logo to={area === 'agent' ? '/agent' : '/admin'} /><div className="sidebar-role">{roleText}</div></div>
        <nav className="side-nav">
          {menu.map(([to, icon, text]) => (
            <NavLink key={to} to={to} end={to === '/agent' || to === '/admin'} className="side-link">
              <Icon name={icon} /><span>{text}</span>{counts[to] > 0 && <span className="count">{counts[to]}</span>}
            </NavLink>
          ))}
          <div className="side-sep" />
          <Link to="/listings" className="side-link"><Icon name="globe" /><span>View public site</span></Link>
          <Link to={`/help#${help || area}`} className="side-link"><Icon name="help" /><span>Help</span></Link>
          <button className="side-link" onClick={doLogout}><Icon name="logout" /><span>Log out</span></button>
        </nav>
        <div className="sidebar-foot">KejaLink v2.0</div>
      </aside>
      <div className={`sidebar-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <div className="panel-main">
        <header className="topbar">
          <button className="icon-btn panel-toggle" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <div className="spacer" />
          <Link to={`/help#${help || area}`} className="icon-btn" aria-label="Help for this page" title="Help for this page"><Icon name="help" /></Link>
          <NotificationBell />
          <UserMenu />
        </header>
        <main id="main" className="panel-content"><Outlet /></main>
      </div>
    </div>
  );
}
