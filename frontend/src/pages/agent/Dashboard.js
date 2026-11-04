/** Agent dashboard. */
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import ViewingActions from '../../components/ViewingActions';
import VerificationBanner from '../../components/VerificationBanner';
import { EmptyState, Loading, LoadError, StatCard, StatusBadge, SubmitButton, TextArea, Field } from '../../components/ui';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useApi from '../../hooks/useApi';
import useForm from '../../hooks/useForm';
import useTitle from '../../hooks/useTitle';
import { coverUrl, dateParts, fmtTime, priceLabel, timeAgo, PROPERTY_TYPES, label } from '../../utils/format';

function QuickReply({ inquiry, onDone }) {
  const toast = useToast();
  const form = useForm({ reply: '' });
  const send = (e) => {
    e.preventDefault();
    form.submit(async (v) => { toast.success((await api.patch(`/agent/inquiries/${inquiry.inquiry_id}`, { action: 'reply', ...v })).message); onDone(); },
      { validate: (v) => (v.reply.trim().length < 2 ? { reply: 'Write a reply first.' } : {}) });
  };
  return (
    <form onSubmit={send} noValidate>
      <p className="muted small">{inquiry.client_name} about {inquiry.title} · {timeAgo(inquiry.created_at)}</p>
      <div className="quote mb-4">{inquiry.message}</div>
      <Field label="Your reply" name="reply" error={form.errors.reply}><TextArea form={form} name="reply" rows={3} /></Field>
      <SubmitButton busy={form.submitting}>Send reply</SubmitButton>
    </form>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  useTitle('Agent dashboard');
  const { data, loading, error, reload } = useApi('/agent/dashboard');
  const approved = user.verification_status === 'approved';
  if (loading && !data) return <Loading />;
  if (error) return <LoadError error={error} retry={reload} />;
  const s = data.stats;
  return (
    <>
      <div className="page-head">
        <div><span className="eyebrow">Agent portal</span><h1>Welcome back, {user.full_name.split(' ')[0]}</h1></div>
        {approved && <Link to="/agent/listings/new" className="btn btn-primary"><Icon name="plus" />Add new listing</Link>}
      </div>
      <VerificationBanner user={user} />
      <div className="stats">
        <StatCard label="Active listings" value={s.active_listings} icon="building" to="/agent/listings" />
        <StatCard label="Open inquiries" value={s.open_inquiries} icon="message" to="/agent/inquiries" />
        <StatCard label="Viewings awaiting reply" value={s.awaiting} icon="clock" highlight={s.awaiting > 0} to="/agent/viewings" />
        <StatCard label="Viewings this week" value={s.this_week} icon="calendar" to="/agent/viewings" />
      </div>
      <div className="card">
        <div className="card-title"><h2>Upcoming viewing requests</h2><Link to="/agent/viewings" className="small">See all</Link></div>
        {data.requests.length === 0 ? <EmptyState icon="calendar" title="No upcoming viewings" text="New requests from clients will appear here." /> : data.requests.map((v) => {
          const d = dateParts(v.scheduled_at);
          return (
            <div className="req" key={v.viewing_id}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <div className="date-chip"><b>{d.day}</b><span>{d.month}</span></div>
                <div><div className="bold">{v.title}, {v.location}</div><div className="small muted">{v.client_name} · {fmtTime(v.scheduled_at)} · <StatusBadge status={v.viewing_status} /></div></div>
              </div>
              <ViewingActions viewing={v} onDone={reload} />
            </div>
          );
        })}
      </div>
      <div className="card">
        <div className="card-title"><h2>My listings</h2><Link to="/agent/listings" className="small">Manage all</Link></div>
        {data.listings.length === 0 ? <EmptyState icon="building" title="No listings yet" text={approved ? 'Add your first property to start receiving inquiries.' : 'You can add listings once your licence is verified.'} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Property</th><th>Type</th><th className="num">Price</th><th>Status</th><th className="num">Views</th><th /></tr></thead>
            <tbody>{data.listings.map((p) => (
              <tr key={p.property_id}>
                <td><div className="row" style={{ flexWrap: 'nowrap' }}><img className="thumb" src={coverUrl(p.cover)} alt="" /><div><Link to={`/properties/${p.property_id}`} className="bold">{p.title}</Link><div className="xsmall muted">{p.location}</div></div></div></td>
                <td>{label(p.listing_type)} · {PROPERTY_TYPES[p.property_type]}</td>
                <td className="num nowrap">{priceLabel(p)}</td>
                <td><StatusBadge status={p.listing_status} /></td>
                <td className="num">{p.views_count}</td>
                <td>{approved && <Link to={`/agent/listings/${p.property_id}/edit`}>Edit</Link>}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </div>
      {data.latestInquiry && <div className="card"><div className="card-title"><h2>Latest inquiry</h2></div><QuickReply inquiry={data.latestInquiry} onDone={reload} /></div>}
    </>
  );
}
