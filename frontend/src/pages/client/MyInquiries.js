/** Client: questions sent to agents and their replies. */
import { Link } from 'react-router-dom';
import { EmptyState, Loading, LoadError, StatusBadge } from '../../components/ui';
import useApi from '../../hooks/useApi';
import useTitle from '../../hooks/useTitle';
import { fmtDateTime } from '../../utils/format';

export default function MyInquiries() {
  useTitle('My inquiries');
  const { data, loading, error, reload } = useApi('/me/inquiries');
  return (
    <>
      <div className="page-head"><div><span className="eyebrow">Messages</span><h1>My inquiries</h1><p>Questions you've sent to agents, and their answers.</p></div></div>
      {error && <LoadError error={error} retry={reload} />}
      {loading ? <Loading /> : data.length === 0 ? <div className="card"><EmptyState icon="message" title="No inquiries yet" text='Use "Ask the agent" on any listing to send a question.' /></div> : data.map((i) => (
        <div className="card" key={i.inquiry_id}>
          <div className="row-between mb-4"><Link to={`/properties/${i.property_id}#inquire`} className="bold">{i.title}</Link><StatusBadge status={i.inquiry_status} /></div>
          <div className="quote"><div className="xsmall muted mb-2">You · {fmtDateTime(i.created_at)}</div>{i.message}</div>
          {i.agent_reply ? <div className="quote reply mt-2"><div className="xsmall muted mb-2">{i.agent_name} · {fmtDateTime(i.replied_at)}</div>{i.agent_reply}</div>
            : <p className="small muted mt-2 mb-0">Waiting for {i.agent_name} to reply.</p>}
        </div>
      ))}
    </>
  );
}
