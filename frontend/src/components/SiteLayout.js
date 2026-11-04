/** SiteLayout: the frame for public and client pages (top navigation + footer). */
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import Logo from './Logo';
import Icon from './Icon';
import { NotificationBell, UserMenu } from './HeaderMenus';
import { useAuth } from '../context/AuthContext';

export default function SiteLayout() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setMenuOpen(false); window.scrollTo(0, 0); }, [location.pathname]);

  const links = [['/listings', 'Browse']];
  if (user && user.role === 'client') links.push(['/client/saved', 'Saved'], ['/client/viewings', 'My viewings'], ['/client/inquiries', 'My inquiries']);
  if (user && user.role === 'agent') links.push(['/agent', 'Agent portal']);
  if (user && ['admin', 'super_admin'].includes(user.role)) links.push(['/admin', 'Admin panel']);
  links.push(['/help', 'Help']);

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="site-header">
        <div className="container">
          <Logo />
          <button className="icon-btn menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Menu"><Icon name={menuOpen ? 'x' : 'menu'} /></button>
          <nav className={`main-nav ${menuOpen ? 'open' : ''}`} aria-label="Main">
            {links.map(([to, text]) => <NavLink key={to} to={to} end={to === '/agent' || to === '/admin'}>{text}</NavLink>)}
          </nav>
          <div className="header-actions">
            {user ? (<><NotificationBell /><UserMenu /></>) : (
              <>
                <Link to="/register" className="btn btn-ghost hide-sm">Register</Link>
                <Link to="/login" className="btn btn-primary">Log in</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="site-main">
        <div className="container"><Outlet /></div>
      </main>
      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <Logo />
              <p className="small mt-4" style={{ maxWidth: 380 }}>Verified agents, real listings, and viewings booked in a few clicks instead of endless WhatsApp threads.</p>
            </div>
            <div>
              <h4>Explore</h4>
              <ul>
                <li><Link to="/listings?listing_type=rent">Homes to rent</Link></li>
                <li><Link to="/listings?listing_type=sale">Property for sale</Link></li>
                <li><Link to="/register?role=agent">List as an agent</Link></li>
              </ul>
            </div>
            <div>
              <h4>Support</h4>
              <ul>
                <li><Link to="/help">Help centre &amp; FAQ</Link></li>
                <li><Link to="/help#terms">Terms &amp; privacy</Link></li>
                <li><a href="mailto:support@kejalink.co.ke">support@kejalink.co.ke</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom"><span>© {new Date().getFullYear()} KejaLink Realty Solutions Ltd</span><span>Made in Nairobi</span></div>
        </div>
      </footer>
    </>
  );
}
