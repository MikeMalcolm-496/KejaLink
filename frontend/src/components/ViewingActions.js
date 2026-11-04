/**
 * ViewingActions: the agent's Confirm / Reschedule / Decline / Mark completed
 * buttons for one viewing. The server decides which changes are allowed
 * (see TRANSITIONS in viewingService.js); this only shows the buttons.
 */
import { useState } from 'react';
import { Field, Modal, ReasonDialog, SubmitButton, useConfirm } from './ui';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { nairobiDate } from '../utils/format';

const SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
const ALLOWED = {
  requested: ['confirmed', 'rescheduled', 'declined'],
  confirmed: ['rescheduled', 'declined', 'completed'],
  rescheduled: ['confirmed', 'rescheduled', 'declined', 'completed'],
};

function Reschedule({ viewing, onDone, onClose }) {
  const toast = useToast();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!date || !time) { setError('Choose a new date and time.'); return; }
    setBusy(true);
    try {
      const r = await api.patch(`/agent/viewings/${viewing.viewing_id}`, { status: 'rescheduled', date, time, note });
      toast.success(r.message); onClose(); onDone();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Reschedule viewing" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <p className="small muted">{viewing.title} with {viewing.client_name}</p>
        <div className="form-grid">
          <Field label="New date" name="rdate"><input id="rdate" type="date" className="input" min={nairobiDate(1)} max={nairobiDate(30)} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Time" name="rtime"><select id="rtime" className="select" value={time} onChange={(e) => setTime(e.target.value)}><option value="">Choose</option>{SLOTS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <Field label="Note to the client (optional)" name="rnote"><input id="rnote" className="input" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The current tenant is in until 3pm" /></Field>
        {error && <p className="field-error">{error}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <SubmitButton busy={busy}>Reschedule</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

export default function ViewingActions({ viewing, onDone }) {
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [confirm, dialog] = useConfirm();
  const allowed = ALLOWED[viewing.viewing_status] || [];
  const past = new Date(viewing.scheduled_at) <= new Date();

  const change = async (status, extra = {}) => {
    try { const r = await api.patch(`/agent/viewings/${viewing.viewing_id}`, { status, ...extra }); toast.success(r.message); onDone(); } catch (err) { toast.error(err.message); throw err; }
  };
  const complete = async () => {
    if (await confirm({ title: 'Mark as completed?', text: `Confirm that the viewing of ${viewing.title} took place.`, confirmText: 'Mark completed', tone: 'primary' })) change('completed').catch(() => {});
  };

  return (
    <div className="req-actions">
      {allowed.includes('confirmed') && <button className="btn btn-primary btn-sm" onClick={() => change('confirmed').catch(() => {})}>Confirm</button>}
      {allowed.includes('rescheduled') && <button className="btn btn-ghost btn-sm" onClick={() => setModal('reschedule')}>Reschedule</button>}
      {allowed.includes('declined') && <button className="btn btn-danger btn-sm" onClick={() => setModal('decline')}>Decline</button>}
      {allowed.includes('completed') && past && <button className="btn btn-ghost btn-sm" onClick={complete}>Mark completed</button>}
      {modal === 'reschedule' && <Reschedule viewing={viewing} onDone={onDone} onClose={() => setModal(null)} />}
      {modal === 'decline' && (
        <ReasonDialog title="Decline viewing" text={`${viewing.title} with ${viewing.client_name}. Your reason is sent to the client.`} confirmText="Decline viewing"
          onSubmit={(note) => change('declined', { note })} onClose={() => setModal(null)} />
      )}
      {dialog}
    </div>
  );
}
