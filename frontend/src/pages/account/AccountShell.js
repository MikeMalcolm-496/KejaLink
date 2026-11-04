/** Account pages sit inside the panel for agents/admins, and inside the public site for clients. */
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PanelLayout from '../../components/PanelLayout';
import SiteLayout from '../../components/SiteLayout';

export default function AccountShell() {
  const { user } = useAuth();
  if (user.role === 'agent') return <PanelLayout area="agent" help="account" />;
  if (user.role === 'admin' || user.role === 'super_admin') return <PanelLayout area="admin" help="account" />;
  return <SiteLayout />;
}
