/** Home page: hero search, featured listings, how it works, call to agents. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import ListingCard from '../components/ListingCard';
import { Loading, LoadError } from '../components/ui';
import useApi from '../hooks/useApi';
import useTitle from '../hooks/useTitle';
import { toArray } from '../utils/normalizeList';

/** Decorative Nairobi skyline for the hero. */
function Skyline() {
  return (
    <svg className="hero-art" viewBox="0 0 460 300" aria-hidden="true">
      <g fill="#134e40"><rect x="10" y="120" width="70" height="180" rx="4" /><rect x="330" y="70" width="90" height="230" rx="4" /></g>
      <g fill="#19634f"><rect x="90" y="60" width="96" height="240" rx="4" /><rect x="400" y="150" width="60" height="150" rx="4" /></g>
      <path d="M196 180 262 128l66 52v120H196z" fill="#227a61" />
      <rect x="248" y="232" width="28" height="68" rx="3" fill="#0b2f27" />
      <g fill="#f0a23a">
        {[[104, 84], [128, 84], [152, 84], [104, 124], [152, 164], [128, 204], [346, 96], [372, 136], [396, 96], [346, 176], [26, 150], [50, 190]].map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="14" height="18" rx="2" />)}
      </g>
    </svg>
  );
}

export default function Home() {
  useTitle('Find verified homes in Kenya');
  const navigate = useNavigate();
  const [q, setQ] = useState({ location: '', listing_type: '', bedrooms: '' });
  const listings = useApi('/properties', { per_page: 6 });
  const stats = useApi('/properties/stats');
  const locations = useApi('/properties/locations');
  const listingItems = toArray(listings.data);
  const locationItems = toArray(locations.data);

  const search = (e) => {
    e.preventDefault();
    const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v));
    navigate(`/listings?${params}`);
  };

  return (
    <>
      <section className="hero">
        <Skyline />
        <span className="eyebrow" style={{ color: 'var(--amber)' }}>Verified agents · Real listings</span>
        <h1>Find a home you can <em>actually visit</em> this week.</h1>
        <p className="hero-lead">Search listings from licensed Kenyan agents and book a viewing slot in a few clicks, without the WhatsApp back-and-forth.</p>
        <form className="hero-search" onSubmit={search} role="search">
          <div className="hs-field">
            <label htmlFor="h-loc">Where</label>
            <input id="h-loc" list="h-locs" placeholder="Kilimani, Westlands…" value={q.location} onChange={(e) => setQ({ ...q, location: e.target.value })} />
            <datalist id="h-locs">{locationItems.map((l) => <option key={l} value={l} />)}</datalist>
          </div>
          <div className="hs-field">
            <label htmlFor="h-type">Looking to</label>
            <select id="h-type" value={q.listing_type} onChange={(e) => setQ({ ...q, listing_type: e.target.value })}>
              <option value="">Rent or buy</option><option value="rent">Rent</option><option value="sale">Buy</option>
            </select>
          </div>
          <div className="hs-field">
            <label htmlFor="h-beds">Bedrooms</label>
            <select id="h-beds" value={q.bedrooms} onChange={(e) => setQ({ ...q, bedrooms: e.target.value })}>
              <option value="">Any</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+</option>)}
            </select>
          </div>
          <button className="btn btn-accent"><Icon name="search" />Search</button>
        </form>
        {stats.data && (
          <div className="hero-stats">
            <div><b>{stats.data.listings}</b><span>available listings</span></div>
            <div><b>{stats.data.agents}</b><span>verified agents</span></div>
            <div><b>{stats.data.areas}</b><span>areas covered</span></div>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <div><span className="eyebrow">Fresh this week</span><h2>Featured and latest listings</h2></div>
          <Link to="/listings" className="btn btn-ghost">See all listings <Icon name="arrowRight" size={16} /></Link>
        </div>
        {listings.error && <LoadError error={listings.error} retry={listings.reload} />}
        {listings.loading && !listings.data ? <Loading /> : (
          <div className="listing-grid">{listingItems.map((p) => <ListingCard key={p.property_id} p={p} />)}</div>
        )}
      </section>

      <section className="section">
        <div className="section-head"><div><span className="eyebrow">How it works</span><h2>Three steps to your next keja</h2></div></div>
        <div className="steps">
          <div className="step"><div className="icon-wrap"><Icon name="search" /></div><h3>Search</h3><p className="muted mb-0">Filter by area, budget, property type and bedrooms. Featured and new listings come first.</p></div>
          <div className="step"><div className="icon-wrap"><Icon name="message" /></div><h3>Save &amp; ask</h3><p className="muted mb-0">Save homes you like and ask the agent about deposits, parking or water directly on the listing.</p></div>
          <div className="step"><div className="icon-wrap"><Icon name="calendar" /></div><h3>Book a viewing</h3><p className="muted mb-0">Pick a free slot on the agent's calendar. You're notified the moment it's confirmed.</p></div>
        </div>
      </section>

      <section className="section cta-band">
        <div><h2>Are you a licensed agent?</h2><p className="mb-0">List properties and manage every inquiry and viewing request in one dashboard. Free to join.</p></div>
        <Link to="/register?role=agent" className="btn btn-primary">Register as an agent <Icon name="arrowRight" size={16} /></Link>
      </section>
    </>
  );
}
