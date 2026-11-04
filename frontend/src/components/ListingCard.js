/** ListingCard: one property in a grid (home, search, saved, similar). */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { money, specs, isFeatured, coverUrl } from '../utils/format';

export function FavouriteButton({ propertyId, initial, onChange, className = 'fav-btn' }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);
  if (user && user.role !== 'client') return null;
  const toggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { navigate('/login', { state: { message: 'Log in with a client account to save properties.' } }); return; }
    setBusy(true);
    try {
      const r = await api.post(`/properties/${propertyId}/favourite`);
      setSaved(r.saved);
      toast.success(r.saved ? 'Saved to your favourites.' : 'Removed from your favourites.');
      if (onChange) onChange(r.saved);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className={`${className} ${saved ? 'saved' : ''}`} onClick={toggle} disabled={busy} aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save property'}>
      <Icon name={saved ? 'heartFill' : 'heart'} />
    </button>
  );
}

export default function ListingCard({ p, onUnsave }) {
  return (
    <article className="listing-card">
      <div className="listing-photo">
        <img src={coverUrl(p.cover)} alt="" loading="lazy" />
        <div className="listing-tags">
          <span className="tag">For {p.listing_type}</span>
          {isFeatured(p) && <span className="tag tag-featured">★ Featured</span>}
          {p.listing_status === 'under_offer' && <span className="tag tag-offer">Under offer</span>}
        </div>
        <FavouriteButton propertyId={p.property_id} initial={p.is_saved} onChange={(s) => !s && onUnsave && onUnsave(p.property_id)} />
      </div>
      <div className="listing-body">
        <div className="price">{money(p.price)}{p.listing_type === 'rent' && <small> / month</small>}</div>
        <h3 className="listing-title"><Link to={`/properties/${p.property_id}`}>{p.title}</Link></h3>
        <div className="listing-meta"><span><Icon name="pin" />{p.location}</span></div>
        <div className="listing-foot">
          <span>{specs(p)}</span>
          <span className="bold" style={{ color: 'var(--emerald)' }}>View <Icon name="arrowRight" size={13} /></span>
        </div>
      </div>
    </article>
  );
}
