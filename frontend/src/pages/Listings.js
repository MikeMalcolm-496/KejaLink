/**
 * Listings: search and filter (FR3). Filters live in the URL (?location=…),
 * so results can be shared, bookmarked and survive a page refresh.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import ListingCard from '../components/ListingCard';
import { EmptyState, Loading, LoadError, Pagination } from '../components/ui';
import useApi from '../hooks/useApi';
import useTitle from '../hooks/useTitle';
import { PROPERTY_TYPES, money } from '../utils/format';
import { toArray } from '../utils/normalizeList';
import { digitsOnly } from '../utils/validation';

const KEYS = ['location', 'listing_type', 'property_type', 'min_price', 'max_price', 'bedrooms'];

export default function Listings() {
  useTitle('Browse listings');
  const [params, setParams] = useSearchParams();
  const current = Object.fromEntries(KEYS.map((k) => [k, params.get(k) || '']));
  const [form, setForm] = useState(current);
  const searchRef = useRef(null);
  const query = { ...current, sort: params.get('sort') || 'newest', page: params.get('page') || 1 };
  const { data, loading, error, reload } = useApi('/properties', query);
  const locations = useApi('/properties/locations');
  const locationItems = toArray(locations.data);
  const listingItems = toArray(data);

  useEffect(() => setForm(current), [params.toString()]);   // keep the form in sync with the URL
  // Keyboard shortcut: "/" jumps to the location box
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { e.preventDefault(); searchRef.current.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const apply = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    setParams(next);
    if ('page' in changes) window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const submit = (e) => { e.preventDefault(); apply(form); };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const chipLabels = {
    location: (v) => v, listing_type: (v) => (v === 'rent' ? 'For rent' : 'For sale'), property_type: (v) => PROPERTY_TYPES[v],
    min_price: (v) => `From ${money(v)}`, max_price: (v) => `Up to ${money(v)}`, bedrooms: (v) => `${v}+ bedrooms`,
  };
  const active = KEYS.filter((k) => current[k]);

  return (
    <>
      <div className="page-head">
        <div><span className="eyebrow">Browse</span><h1>Find a home or property</h1><p>Search verified listings from licensed agents. <span className="kbd">/</span> jumps to search.</p></div>
      </div>
      <form className="search-bar" onSubmit={submit} role="search" aria-label="Filter listings">
        <div className="search-grid">
          <div className="field"><label htmlFor="location">Location</label>
            <input ref={searchRef} id="location" className="input" list="locs" placeholder="e.g. Kilimani" maxLength={100} value={form.location} onChange={set('location')} />
            <datalist id="locs">{locationItems.map((l) => <option key={l} value={l} />)}</datalist></div>
          <div className="field"><label htmlFor="listing_type">Listing type</label>
            <select id="listing_type" className="select" value={form.listing_type} onChange={set('listing_type')}><option value="">Any</option><option value="rent">For rent</option><option value="sale">For sale</option></select></div>
          <div className="field"><label htmlFor="property_type">Property type</label>
            <select id="property_type" className="select" value={form.property_type} onChange={set('property_type')}><option value="">Any</option>{Object.entries(PROPERTY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="field"><label htmlFor="min_price">Min price (KES)</label>
            <input id="min_price" className="input" inputMode="numeric" placeholder="0" maxLength={11} value={form.min_price} onKeyDown={digitsOnly} onChange={set('min_price')} /></div>
          <div className="field"><label htmlFor="max_price">Max price (KES)</label>
            <input id="max_price" className="input" inputMode="numeric" placeholder="Any" maxLength={11} value={form.max_price} onKeyDown={digitsOnly} onChange={set('max_price')} /></div>
          <div className="field"><label htmlFor="bedrooms">Bedrooms</label>
            <select id="bedrooms" className="select" value={form.bedrooms} onChange={set('bedrooms')}><option value="">Any</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+</option>)}</select></div>
        </div>
        <div className="row mt-4">
          <button className="btn btn-primary"><Icon name="search" />Search</button>
          {active.length > 0 && <button type="button" className="btn btn-link" onClick={() => setParams({})}>Clear all filters</button>}
        </div>
      </form>

      <div className="row-between mb-4">
        <div className="row">
          <h2 className="mb-0" style={{ fontSize: 'var(--text-lg)' }} aria-live="polite">
            {data ? `${data.total} listing${data.total === 1 ? '' : 's'} found` : 'Searching…'}
            {data && <span className="muted small" style={{ fontWeight: 400 }}> ({data.ms} ms)</span>}
          </h2>
          <div className="chips">
            {active.map((k) => <button key={k} className="chip" onClick={() => apply({ [k]: '' })} aria-label={`Remove filter ${chipLabels[k](current[k])}`}>{chipLabels[k](current[k])}<Icon name="x" /></button>)}
          </div>
        </div>
        <div className="row">
          <label htmlFor="sort" className="small muted">Sort by</label>
          <select id="sort" className="select" style={{ width: 'auto', minHeight: 40 }} value={query.sort} onChange={(e) => apply({ sort: e.target.value })}>
            <option value="newest">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option><option value="popular">Most viewed</option>
          </select>
        </div>
      </div>

      {error && <LoadError error={error} retry={reload} />}
      {loading && !data ? <Loading /> : data && listingItems.length === 0 ? (
        <div className="card"><EmptyState icon="home" title="No listings match your search" text="Try a nearby area, a wider price range or fewer filters." action={<button className="btn btn-primary" onClick={() => setParams({})}>Clear all filters</button>} /></div>
      ) : (
        <div className="listing-grid" style={{ opacity: loading ? 0.5 : 1 }}>{listingItems.map((p) => <ListingCard key={p.property_id} p={p} />)}</div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onChange={(p) => apply({ page: String(p) })} />}
    </>
  );
}
