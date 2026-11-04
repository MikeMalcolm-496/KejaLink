/**
 * App: providers + every route in the system.
 *   /            public site (SiteLayout)
 *   /client/...  client pages (must be a client)
 *   /agent/...   agent portal (PanelLayout, must be an agent)
 *   /admin/...   admin panel (PanelLayout, must be an admin or super admin)
 */
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
import RequireAuth from './components/RequireAuth';
import SiteLayout from './components/SiteLayout';
import PanelLayout from './components/PanelLayout';

import Home from './pages/Home';
import Listings from './pages/Listings';
import PropertyDetails from './pages/PropertyDetails';
import Help from './pages/Help';
import NotFound from './pages/NotFound';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import TwoFactor from './pages/auth/TwoFactor';
import ChangePassword from './pages/auth/ChangePassword';
import Saved from './pages/client/Saved';
import MyViewings from './pages/client/MyViewings';
import MyInquiries from './pages/client/MyInquiries';
import Profile from './pages/account/Profile';
import Security from './pages/account/Security';
import Notifications from './pages/account/Notifications';
import AgentDashboard from './pages/agent/Dashboard';
import AgentListings from './pages/agent/Listings';
import ListingForm from './pages/agent/ListingForm';
import AgentViewings from './pages/agent/Viewings';
import AgentInquiries from './pages/agent/Inquiries';
import AgentPayments from './pages/agent/Payments';
import Reports from './pages/Reports';
import AdminOverview from './pages/admin/Overview';
import AdminAgents from './pages/admin/Agents';
import AdminUsers from './pages/admin/Users';
import AdminUserForm from './pages/admin/UserForm';
import AdminListings from './pages/admin/Listings';
import AdminViewings from './pages/admin/Viewings';
import AdminPayments from './pages/admin/Payments';
import AdminAudit from './pages/admin/Audit';
import AdminAdmins from './pages/admin/Admins';
import AccountShell from './pages/account/AccountShell';

const ADMINS = ['admin', 'super_admin'];

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route element={<SiteLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/listings" element={<Listings />} />
                <Route path="/properties/:id" element={<PropertyDetails />} />
                <Route path="/help" element={<Help />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/two-factor" element={<TwoFactor />} />
                <Route path="/change-password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
                <Route path="/client/saved" element={<RequireAuth roles={['client']}><Saved /></RequireAuth>} />
                <Route path="/client/viewings" element={<RequireAuth roles={['client']}><MyViewings /></RequireAuth>} />
                <Route path="/client/inquiries" element={<RequireAuth roles={['client']}><MyInquiries /></RequireAuth>} />
                <Route path="*" element={<NotFound />} />
              </Route>

              {/* Account pages use the panel frame for agents/admins and the site frame for clients */}
              <Route path="/account" element={<RequireAuth><AccountShell /></RequireAuth>}>
                <Route path="profile" element={<Profile />} />
                <Route path="security" element={<Security />} />
                <Route path="notifications" element={<Notifications />} />
              </Route>

              <Route path="/agent" element={<RequireAuth roles={['agent']}><PanelLayout area="agent" /></RequireAuth>}>
                <Route index element={<AgentDashboard />} />
                <Route path="listings" element={<AgentListings />} />
                <Route path="listings/new" element={<ListingForm />} />
                <Route path="listings/:id/edit" element={<ListingForm />} />
                <Route path="viewings" element={<AgentViewings />} />
                <Route path="inquiries" element={<AgentInquiries />} />
                <Route path="payments" element={<AgentPayments />} />
                <Route path="reports" element={<Reports scope="agent" />} />
              </Route>

              <Route path="/admin" element={<RequireAuth roles={ADMINS}><PanelLayout area="admin" /></RequireAuth>}>
                <Route index element={<AdminOverview />} />
                <Route path="agents" element={<AdminAgents />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/new" element={<AdminUserForm />} />
                <Route path="users/:id/edit" element={<AdminUserForm />} />
                <Route path="listings" element={<AdminListings />} />
                <Route path="viewings" element={<AdminViewings />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="reports" element={<Reports scope="admin" />} />
                <Route path="audit" element={<AdminAudit />} />
                <Route path="admins" element={<RequireAuth roles={['super_admin']}><AdminAdmins /></RequireAuth>} />
              </Route>
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
