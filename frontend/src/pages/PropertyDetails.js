/**
 * PropertyDetails: one listing. Clients can save it, ask a question,
 * book a viewing (the main transaction) and report it.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import ListingCard, { FavouriteButton } from '../components/ListingCard';
import { Alert, Field, Loading, Modal, StatusBadge, SubmitButton, TextArea } from '../components/ui';
import NotFound from './NotFound';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useApi from '../hooks/useApi';
import useForm from '../hooks/useForm';
import useTitle from '../hooks/useTitle';
import { PROPERTY_TYPES, coverUrl, fmtDate, fmtDateTime, isFeatured, label, money, nairobiDate } from '../utils/format';

function Gallery({ images, title }) {
  const [open, setOpen] = useState(null);
  const shown = images.length ? images : [{ image_url: null }];
  useEffect(() => {
    if (open === null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((i) => (i + 1) % shown.length);
      if (e.key === 'ArrowLeft') setOpen((i) => (i - 1 + shown.length) % shown.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, shown.length]);
  return (
    <>
      <div className={`gallery ${shown.length === 1 ? 'single' : ''}`}>
        {shown.slice(0, 3).map((img, i) => (
          <button key={i} className={i === 0 ? 'main' : ''} onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${shown.length}`}>
            <img src={coverUrl(img.image_url)} alt={i === 0 ? title : ''} />
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="lightbox" role="dialog" aria-label="Photo viewer" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <img src={coverUrl(shown[open].image_url)} alt={`${title}, photo ${open + 1}`} />
          {shown.length > 1 && <>
            <button className="icon-btn nav prev" onClick={() => setOpen((open - 1 + shown.length) % shown.length)} aria-label="Previous photo"><Icon name="arrowLeft" /></button>
            <button className="icon-btn nav next" onClick={() => setOpen((open + 1) % shown.length)} aria-label="Next photo"><Icon name="arrowRight" /></button>
          </>}
          <button className="icon-btn" style={{ position: 'absolute', top: 20, right: 20 }} onClick={() => setOpen(null)} aria-label="Close"><Icon name="x" /></button>
          <div className="count">{open + 1} / {shown.length} · use ← → keys</div>
        </div>
      )}
    </>
  );
}

/** Booking panel: choose a date, see free slots from the server, request one. */
function BookViewing({ property, myViewing, onBooked }) {
  const { user } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState(null);
  const [time, setTime] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTime(''); setSlots(null); setError(null);
    if (!date) return;
    api.get(`/properties/${property.property_id}/slots`, { date })
      .then((r) => setSlots(r.slots))
      .catch((err) => setError(err.message));
  }, [date, property.property_id]);

  if (!user) return <><p className="muted small">Log in or create a free client account to book.</p><Link className="btn btn-primary btn-block" to="/login" state={{ from: `/properties/${property.property_id}` }}>Log in to book</Link></>;
  if (user.role !== 'client') return <p className="muted small mb-0">Viewings are booked from client accounts.</p>;
  if (myViewing) return <><Alert type="success">You have a viewing on <b>{fmtDateTime(myViewing.scheduled_at)}</b> <StatusBadge status={myViewing.viewing_status} /></Alert><Link to="/client/viewings" className="btn btn-ghost btn-block">Manage my viewings</Link></>;
  if (property.listing_status !== 'available') return <p className="muted small mb-0">This property is {label(property.listing_status).toLowerCase()} and not taking new viewings.</p>;

  const book = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api.post(`/properties/${property.property_id}/viewings`, { date, time });
      toast.success(r.message);
      onBooked();
    } catch (err) {
      setError(err.message);
      if (err.status === 409) api.get(`/properties/${property.property_id}/slots`, { date }).then((r) => setSlots(r.slots)).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={book} noValidate>
      <Field label="Date" name="date" hint="Monday to Saturday, up to 30 days ahead.">
        <input type="date" id="date" className="input" min={nairobiDate(1)} max={nairobiDate(30)} value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <fieldset style={{ border: 0, padding: 0, margin: '0 0 16px' }}>
        <legend className="small bold mb-2" style={{ color: 'var(--ink-2)' }}>Time</legend>
        {!date && <p className="muted small mb-0">Choose a date to see free times.</p>}
        {slots && (
          <div className="slot-grid">
            {Object.entries(slots).map(([t, taken]) => (
              <button type="button" key={t} className={`slot ${time === t ? 'selected' : ''}`} disabled={taken} aria-pressed={time === t} aria-label={`${t}${taken ? ', taken' : ''}`} onClick={() => setTime(t)}>{t}</button>
            ))}
          </div>
        )}
      </fieldset>
      {error && <Alert type="error">{error}</Alert>}
      <SubmitButton busy={busy} className="btn btn-primary btn-block" disabled={!time} busyText="Booking…">
        {time ? `Request viewing at ${time}` : 'Request viewing'}
      </SubmitButton>
    </form>
  );
}

function AskAgent({ property, myInquiries, onSent }) {
  const { user } = useAuth();
  const toast = useToast();
  const form = useForm({ message: '' });
  if (!user) return <Link className="btn btn-outline btn-block" to="/login">Log in to send an inquiry</Link>;
  if (user.role !== 'client') return <p className="muted small mb-0">Inquiries are sent from client accounts.</p>;
  const send = (e) => {
    e.preventDefault();
    form.submit(async (v) => {
      const r = await api.post(`/properties/${property.property_id}/inquiries`, v);
      toast.success(r.message);
      form.setValues({ message: '' });
      onSent();
    }, { validate: (v) => (v.message.trim().length < 10 ? { message: 'Write at least 10 characters.' } : {}) });
  };
  return (
    <>
      {myInquiries.map((i) => (
        <div key={i.inquiry_id} className="mb-2">
          <div className="quote"><b>You:</b> {i.message}</div>
          {i.agent_reply ? <div className="quote reply mt-2"><b>Agent:</b> {i.agent_reply}</div> : <p className="xsmall muted mt-2 mb-0">Awaiting reply</p>}
        </div>
      ))}
      <form onSubmit={send} noValidate>
        <Field name="message" error={form.errors.message}>
          <label htmlFor="message" className="sr-only">Your question</label>
          <TextArea form={form} name="message" rows={3} placeholder="e.g. Is the deposit negotiable? Is parking included?" />
        </Field>
        <SubmitButton busy={form.submitting} className="btn btn-outline btn-block">Send inquiry</SubmitButton>
      </form>
    </>
  );
}

function Calculator({ p }) {
  const [dep, setDep] = useState(20);
  const [rate, setRate] = useState(13);
  const [years, setYears] = useState(20);
  const price = Number(p.price);
  if (p.listing_type === 'rent') {
    return (
      <>
        <p className="muted small">A common rule: spend at most 30% of take-home pay on rent. Moving in usually needs a deposit plus the first month.</p>
        <div className="grid-2">
          <div><div className="small muted">Take-home pay needed</div><div className="calc-out">{money(Math.ceil(price / 0.3 / 1000) * 1000)}</div></div>
          <div><div className="small muted">Move-in cost (deposit + 1st month)</div><div className="calc-out">{money(price * 2)}</div></div>
        </div>
      </>
    );
  }
  // monthly = P·r / (1 − (1 + r)^−n)
  const loan = price * (1 - dep / 100);
  const r = rate / 100 / 12;
  const n = years * 12;
  const monthly = r > 0 ? (loan * r) / (1 - (1 + r) ** -n) : loan / n;
  return (
    <>
      <div className="form-grid">
        <Field label="Deposit (%)" name="dep"><input id="dep" type="number" className="input" min="0" max="90" value={dep} onChange={(e) => setDep(Number(e.target.value))} /></Field>
        <Field label="Interest (% a year)" name="rate"><input id="rate" type="number" step="0.1" className="input" min="1" max="30" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></Field>
        <Field label="Years" name="yrs"><input id="yrs" type="number" className="input" min="1" max="30" value={years} onChange={(e) => setYears(Number(e.target.value))} /></Field>
      </div>
      <div className="small muted">Estimated monthly repayment</div>
      <div className="calc-out">{Number.isFinite(monthly) && monthly > 0 ? `${money(monthly)} / month` : '-'}</div>
      <p className="xsmall muted mb-0">Indicative only. Banks set the real rate and terms.</p>
    </>
  );
}

function ReportListing({ id, onClose }) {
  const toast = useToast();
  const form = useForm({ reason: '' });
  const send = (e) => {
    e.preventDefault();
    form.submit(async (v) => { const r = await api.post(`/properties/${id}/report`, v); toast.success(r.message); onClose(); },
      { validate: (v) => (v.reason.trim().length < 10 ? { reason: 'Describe the problem in at least 10 characters.' } : {}) });
  };
  return (
    <Modal title="Report this listing" onClose={onClose}>
      <form onSubmit={send} noValidate>
        <p className="small muted">Admins review every report. For example: the property is already let, the photos are fake, or the agent asked for money before a viewing.</p>
        <Field label="What's wrong?" name="reason" error={form.errors.reason}><TextArea form={form} name="reason" maxLength={255} rows={3} /></Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <SubmitButton busy={form.submitting} className="btn btn-danger-solid">Send report</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

export default function PropertyDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(`/properties/${id}`);
  const [reporting, setReporting] = useState(false);
  useTitle(data ? data.property.title : 'Listing');

  if (loading && !data) return <Loading />;
  if (error) return error.status === 404 ? <NotFound text={error.message} /> : <Alert type="error">{error.message}</Alert>;
  const { property: p, images, isSaved, myViewing, myInquiries, similar } = data;
  const isClient = user && user.role === 'client';
  const share = () => navigator.clipboard && navigator.clipboard.writeText(window.location.href).then(() => toast.success('Link copied. Share it with anyone.'));
  const mapQuery = encodeURIComponent(`${p.address ? `${p.address}, ` : ''}${p.location}, Kenya`);

  return (
    <>
      <nav aria-label="Breadcrumb" className="small muted mb-4">
        <Link to="/listings">Listings</Link> / <Link to={`/listings?location=${encodeURIComponent(p.location)}`}>{p.location}</Link> / <span>{p.title}</span>
      </nav>
      {p.listing_status === 'removed' && <Alert type="error">This listing was removed by an administrator and is hidden from the public.</Alert>}
      <div className="prop-layout">
        <div>
          <Gallery images={images} title={p.title} />
          <div className="prop-title">
            <div className="row">
              <span className="badge tone-good">For {p.listing_type}</span>
              <StatusBadge status={p.listing_status} />
              {isFeatured(p) && <span className="badge tone-warn">★ Featured</span>}
            </div>
            <h1>{p.title}</h1>
            <div className="row-between">
              <div>
                <div className="price" style={{ fontSize: '2rem' }}>{money(p.price)}{p.listing_type === 'rent' && <small> / month</small>}</div>
                <div className="muted"><Icon name="pin" size={16} /> {p.location}{p.address ? ` · ${p.address}` : ''}</div>
              </div>
              <div className="row">
                {(!user || isClient) && <FavouriteButton propertyId={p.property_id} initial={isSaved} className="btn btn-ghost btn-icon" />}
                <button className="btn btn-ghost btn-icon" onClick={share} aria-label="Copy link"><Icon name="share" /></button>
                {p.is_owner && <Link className="btn btn-outline" to={`/agent/listings/${p.property_id}/edit`}><Icon name="edit" />Edit</Link>}
                {user && ['admin', 'super_admin'].includes(user.role) && <Link className="btn btn-danger" to={`/admin/listings?q=${encodeURIComponent(p.title)}`}>Moderate</Link>}
              </div>
            </div>
          </div>
          <div className="spec-row">
            <div className="spec"><Icon name="layers" /><div><small>Type</small><b>{PROPERTY_TYPES[p.property_type]}</b></div></div>
            {!['land', 'commercial'].includes(p.property_type) && <div className="spec"><Icon name="bed" /><div><small>Bedrooms</small><b>{p.bedrooms === 0 ? 'Studio' : p.bedrooms}</b></div></div>}
            {p.property_type !== 'land' && <div className="spec"><Icon name="bath" /><div><small>{p.property_type === 'commercial' ? 'Washrooms' : 'Bathrooms'}</small><b>{p.bathrooms}</b></div></div>}
            <div className="spec"><Icon name="calendar" /><div><small>Listed</small><b>{fmtDate(p.created_at)}</b></div></div>
            <div className="spec"><Icon name="eye" /><div><small>Views</small><b>{p.views_count.toLocaleString()}</b></div></div>
          </div>
          <div className="card">
            <h2 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>About this property</h2>
            <p style={{ whiteSpace: 'pre-line' }} className="mb-0">{p.description || 'The agent has not added a description yet. Send an inquiry for details.'}</p>
          </div>
          <div className="card">
            <h2 className="card-title" style={{ fontSize: 'var(--text-lg)' }}><span><Icon name="map" /> Location</span></h2>
            <iframe className="map-frame" title={`Map of ${p.location}`} loading="lazy" src={`https://maps.google.com/maps?q=${mapQuery}&z=14&output=embed`} />
            <p className="xsmall muted mt-2 mb-0">Shows the general area. The exact address is shared once your viewing is confirmed. The map needs an internet connection.</p>
          </div>
          <div className="card">
            <h2 className="card-title" style={{ fontSize: 'var(--text-lg)' }}><span><Icon name="calculator" /> {p.listing_type === 'rent' ? 'Can I afford this rent?' : 'Mortgage estimate'}</span></h2>
            <Calculator p={p} />
          </div>
        </div>

        <aside className="side-sticky">
          <div className="card">
            <div className="agent-card">
              <span className="avatar avatar-lg">{p.agent_name.charAt(0)}</span>
              <div>
                <b>{p.agent_name}</b>
                <div className="small muted">{p.agency_name || 'Independent agent'}</div>
                <span className="verified"><Icon name="check" size={14} />Verified licence {p.licence_no}</span>
              </div>
            </div>
            {p.agent_bio && <p className="small muted mt-4 mb-0">{p.agent_bio}</p>}
            <p className="xsmall muted mt-2">{p.agent_listing_count} listing{p.agent_listing_count === 1 ? '' : 's'} on KejaLink</p>
            {p.agent_phone ? <a className="btn btn-ghost btn-block" href={`tel:${p.agent_phone}`}><Icon name="phone" />{p.agent_phone}</a>
              : <Link className="btn btn-ghost btn-block" to="/login"><Icon name="phone" />Log in to see phone number</Link>}
          </div>
          <div className="card" id="book">
            <div className="card-title"><h2>Book a viewing</h2><Link to="/help#booking" aria-label="Help with booking"><Icon name="help" /></Link></div>
            <BookViewing property={p} myViewing={myViewing} onBooked={reload} />
          </div>
          <div className="card" id="inquire">
            <div className="card-title"><h2>Ask the agent</h2></div>
            <AskAgent property={p} myInquiries={myInquiries} onSent={reload} />
          </div>
          {isClient && <button className="btn btn-link small" style={{ alignSelf: 'center', color: 'var(--muted)' }} onClick={() => setReporting(true)}><Icon name="flag" size={14} /> Report this listing</button>}
        </aside>
      </div>
      {similar.length > 0 && (
        <section className="section">
          <h2>Similar listings</h2>
          <div className="listing-grid">{similar.map((s) => <ListingCard key={s.property_id} p={s} />)}</div>
        </section>
      )}
      {reporting && <ReportListing id={p.property_id} onClose={() => setReporting(false)} />}
    </>
  );
}
