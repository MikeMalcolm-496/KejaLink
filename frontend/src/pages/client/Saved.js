/** Client: saved (favourite) properties. */
import { Link } from 'react-router-dom';
import ListingCard from '../../components/ListingCard';
import { EmptyState, Loading, LoadError } from '../../components/ui';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';

export default function Saved() {
  useTitle('Saved properties');
  const { data, loading, error, reload } = useApi('/me/favourites');
  return (
    <>
      <div className="page-head"><div><span className="eyebrow">Your shortlist</span><h1>Saved properties</h1><p>Tap the heart to remove a home from this list.</p></div></div>
      {error && <LoadError error={error} retry={reload} />}
      {loading ? <Loading /> : data && data.length === 0 ? (
        <div className="card"><EmptyState icon="heart" title="Nothing saved yet" text="Tap the heart on any listing to keep it here." action={<Link to="/listings" className="btn btn-primary">Browse listings</Link>} /></div>
      ) : <div className="listing-grid">{(data || []).map((p) => <ListingCard key={p.property_id} p={p} onUnsave={reload} />)}</div>}
    </>
  );
}
