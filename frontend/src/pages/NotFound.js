import { Link } from 'react-router-dom';
import useTitle from '../hooks/useTitle';

export default function NotFound({ text }) {
  useTitle('Not found');
  return (
    <div className="error-page">
      <div className="big">404</div>
      <h1>We couldn't find that page</h1>
      <p className="muted">{text || 'The link may be old, or the listing may have been removed.'}</p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link to="/listings" className="btn btn-primary">Browse listings</Link>
        <Link to="/help" className="btn btn-ghost">Get help</Link>
      </div>
    </div>
  );
}
