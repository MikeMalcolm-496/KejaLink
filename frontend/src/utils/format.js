/** format.js: how money, dates and statuses are shown everywhere. */
const TZ = 'Africa/Nairobi';

export const money = (n) => `KES ${Math.round(Number(n || 0)).toLocaleString('en-KE')}`;

export const priceLabel = (p) => money(p.price) + (p.listing_type === 'rent' ? ' / month' : '');

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }) : '-');

export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ,
}) : '-');

export const fmtTime = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });

/** Parts for the calendar-style date chip. */
export const dateParts = (d) => {
  const date = new Date(d);
  return {
    day: date.toLocaleDateString('en-GB', { day: 'numeric', timeZone: TZ }),
    month: date.toLocaleDateString('en-GB', { month: 'short', timeZone: TZ }),
  };
};

export function timeAgo(d) {
  if (!d) return '';
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(d);
}

export const label = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '');

export const roleLabel = (r) => ({ client: 'Client', agent: 'Agent', admin: 'Admin', super_admin: 'Super admin' }[r] || r);

export const PROPERTY_TYPES = { apartment: 'Apartment', house: 'House', land: 'Land', commercial: 'Commercial' };
export const LISTING_STATUSES = { available: 'Available', under_offer: 'Under offer', sold: 'Sold', rented: 'Rented' };

/** "2 bed · 2 bath", "Studio · 1 bath", "Land", "Commercial · 2 washrooms" */
export function specs(p) {
  if (p.property_type === 'land') return 'Land';
  if (p.property_type === 'commercial') return `Commercial · ${p.bathrooms} washroom${p.bathrooms === 1 ? '' : 's'}`;
  return `${p.bedrooms === 0 ? 'Studio' : `${p.bedrooms} bed`} · ${p.bathrooms} bath`;
}

export const isFeatured = (p) => Boolean(p.featured_until && new Date(p.featured_until) > new Date());

export const coverUrl = (url) => url || '/seed/placeholder.svg';

/** Today in Nairobi as YYYY-MM-DD, plus n days. */
export function nairobiDate(addDays = 0) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + addDays);
  return d.toISOString().slice(0, 10);
}
