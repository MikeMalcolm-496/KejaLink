/** Agent: read and reply to client inquiries (FR4). */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, Field, Loading, LoadError, StatusBadge, SubmitButton, TextArea, useConfirm } from '../../components/ui';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import useForm from '../../hooks/useForm';
import useTitle from '../../hooks/useTitle';
import { fmtDateTime } from '../../utils/format';

function InquiryCard({ i, onDone }) {
  const toast = useToast();
  const form = useForm({ reply: '' });
  const [confirm, dialog] = useConfirm();
  const send = (e) => {
    e.preventDefault();
    form.submit(async (v) => { toast.success((await api.patch(`/agent/inquiries/${i.inquiry_id}`, { action: 'reply', ...v })).message); onDone(); },
      { validate: (v) => (v.reply.trim().length < 2 ? { reply: 'Write a reply first.' } : {}) });
  };
  const close = async () => {
    if (!(await confirm({ title: 'Close inquiry?', text: 'The client can still send a new one.', confirmText: 'Close inquiry', tone: 'primary' }))) return;
    try { toast.success((await api.patch(`/agent/inquiries/${i.inquiry_id}`, { action: 'close' })).message); onDone(); } catch (err) { toast.error(err.message); }
  };
  return (
    <div className="card">
      <div className="row-between mb-2">
        <div><b>{i.client_name}</b> <span className="muted small">about</span> <Link to={`/properties/${i.property_id}`}>{i.title}</Link>
          <div className="xsmall muted">{fmtDateTime(i.created_at)} · <a href={`tel:${i.client_phone}`}>{i.client_phone}</a></div></div>
        <StatusBadge status={i.inquiry_status} />
      </div>
      <div className="quote mb-4">{i.message}</div>
      {i.agent_reply && <div className="quote reply mb-4"><div className="xsmall muted mb-2">Your reply · {fmtDateTime(i.replied_at)}</div>{i.agent_reply}</div>}
      {i.inquiry_status !== 'closed' && (
        <form onSubmit={send} noValidate>
          <Field label={i.agent_reply ? 'Update your reply' : 'Your reply'} name={`reply-${i.inquiry_id}`} error={form.errors.reply}>
            <textarea className="textarea" rows={2} maxLength={1000} {...form.bind("reply")} id={`reply-${i.inquiry_id}`} />
          </Field>
          <div className="row"><SubmitButton busy={form.submitting} className="btn btn-primary btn-sm">Send reply</SubmitButton><button type="button" className="btn btn-ghost btn-sm" onClick={close}>Close</button></div>
        </form>
      )}
      {dialog}
    </div>
  );
}

export default function Inquiries() {
  useTitle('Inquiries');
  const [status, setStatus] = useState('open');
  const { data, loading, error, reload } = useApi('/agent/inquiries', { status });
  return (
    <>
      <div className="page-head"><div><h1>Inquiries</h1><p>Questions clients have asked about your listings.</p></div></div>
      <div className="tabs">{[['open', 'Open'], ['replied', 'Replied'], ['closed', 'Closed'], ['all', 'All']].map(([k, t]) => <button key={k} className={`tab ${status === k ? 'active' : ''}`} onClick={() => setStatus(k)}>{t}</button>)}</div>
      {error && <LoadError error={error} retry={reload} />}
      {loading && !data ? <Loading /> : data.length === 0 ? <div className="card"><EmptyState icon="message" title="No inquiries here" text={status === 'open' ? "You're all caught up." : ''} /></div>
        : data.map((i) => <InquiryCard key={i.inquiry_id} i={i} onDone={reload} />)}
    </>
  );
}
