/** Shown to agents whose licence has not been approved yet. */
import { Alert } from './ui';

export default function VerificationBanner({ user }) {
  if (!user || user.role !== 'agent' || user.verification_status === 'approved') return null;
  if (user.verification_status === 'rejected') {
    return <Alert type="error"><b>Verification rejected.</b> {user.rejection_reason || 'Your licence could not be verified.'} Update your details under Profile and contact support@kejalink.co.ke to be reviewed again.</Alert>;
  }
  return <Alert type="warn"><b>Awaiting verification.</b> An administrator is checking licence <b>{user.licence_no}</b>. You'll be notified and can start listing once approved.</Alert>;
}
