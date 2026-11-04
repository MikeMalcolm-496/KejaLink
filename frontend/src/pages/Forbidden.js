import { Link } from 'react-router-dom';
import { useAuth, homeFor } from '../context/AuthContext';
import { roleLabel } from '../utils/format';
import useTitle from '../hooks/useTitle';

export default function Forbidden({ roles = [] }) {
  const { user } = useAuth();
  useTitle('Access denied');
  return (
    <div className="error-page">
      <div className="big">403</div>
      <h1>You don't have access to this page</h1>
      <p className="muted">This page is only for {roles.map(roleLabel).join(' / ')} accounts.</p>
      <Link to={homeFor(user && user.role)} className="btn btn-primary">Go to my home page</Link>
    </div>
  );
}
