/**
 * useAdminAction: run a moderation action (POST /api/admin/actions/:action)
 * with optional confirmation or written reason, then show the result.
 */
import { useState } from 'react';
import { ReasonDialog, useConfirm } from '../../components/ui';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function useAdminAction(onDone) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [reasonFor, setReasonFor] = useState(null);

  const run = async (action, body = {}) => {
    try {
      const r = await api.post(`/admin/actions/${action}`, body);
      toast.success(r.message);
      if (onDone) onDone(r);
      return r;
    } catch (err) {
      toast.error(err.message);
      throw err;
    }
  };
  /** Ask "are you sure?" first. */
  const withConfirm = async (action, body, opts) => { if (await confirm(opts)) await run(action, body).catch(() => {}); };
  /** Ask for a written reason first (saved to the activity log). */
  const withReason = (action, body, title, text) => setReasonFor({ action, body, title, text });

  const dialogs = (
    <>
      {confirmDialog}
      {reasonFor && <ReasonDialog title={reasonFor.title} text={reasonFor.text || 'Your reason is saved to the activity log and shown to the user.'}
        onSubmit={(reason) => run(reasonFor.action, { ...reasonFor.body, reason })} onClose={() => setReasonFor(null)} />}
    </>
  );
  return { run, withConfirm, withReason, dialogs };
}
