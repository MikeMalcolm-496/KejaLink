/**
 * RequireAuth: protects routes in the browser.
 * (The API checks permissions again on every request; this only decides what to show.)
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loading } from './ui';
import Forbidden from '../pages/Forbidden';

export default function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search, message: 'Please log in to continue.' }} />;
  if (user.must_change_password && location.pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(user.role)) return <Forbidden roles={roles} />;
  return children;
}
