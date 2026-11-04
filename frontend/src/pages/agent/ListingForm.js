/**
 * ListingForm: create or edit a listing with photos (FR2).
 * Sent as multipart/form-data so photos travel with the details in one request;
 * the server saves everything in one transaction.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Alert, Field, Input, Loading, SubmitButton, TextArea, useUnsavedWarning } from '../../components/ui';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import useForm from '../../hooks/useForm';
import useTitle from '../../hooks/useTitle';
import { LISTING_STATUSES, PROPERTY_TYPES, money } from '../../utils/format';

const MAX_PHOTOS = 10;
const MAX_MB = 3;

function validate(v, photoCount) {
  const e = {};
  if (v.title.trim().length < 5) e.title = 'Title must be 5 to 150 characters.';
  if (!v.listing_type) e.listing_type = 'Choose rent or sale.';
  if (!v.property_type) e.property_type = 'Choose a property type.';
  if (!/^\d+$/.test(v.price) || Number(v.price) < 1) e.price = 'Enter the price in digits, e.g. 85000.';
  if (v.property_type !== 'land') {
    if (v.bedrooms === '' || Number(v.bedrooms) > 20) e.bedrooms = 'Bedrooms must be 0 to 20.';
    if (v.bathrooms === '' || Number(v.bathrooms) > 20) e.bathrooms = 'Bathrooms must be 0 to 20.';
  }
  if (v.location.trim().length < 2) e.location = 'Enter the area and town, e.g. Kilimani, Nairobi.';
  if (photoCount === 0) e.photos = 'Add at least one photo.';
  if (photoCount > MAX_PHOTOS) e.photos = `A listing can have at most ${MAX_PHOTOS} photos.`;
  return e;
}

export default function ListingForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  useTitle(editing ? 'Edit listing' : 'Add listing');
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(editing);
  const [images, setImages] = useState([]);          // existing photos
  const [remove, setRemove] = useState([]);          // ids of existing photos to delete
  const [cover, setCover] = useState(null);
  const [files, setFiles] = useState([]);            // new photos { file, url }
  const [dragOver, setDragOver] = useState(false);
  const form = useForm({ title: '', listing_type: '', property_type: '', price: '', bedrooms: '1', bathrooms: '1', location: '', address: '', description: '', listing_status: 'available' });
  const [loadError, setLoadError] = useState(null);
  useUnsavedWarning(form.dirty || files.length > 0);

  useEffect(() => {
    if (!editing) return;
    api.get(`/agent/listings/${id}`).then(({ property: p, images: imgs }) => {
      form.setValues({ title: p.title, listing_type: p.listing_type, property_type: p.property_type, price: String(Math.round(p.price)), bedrooms: String(p.bedrooms), bathrooms: String(p.bathrooms), location: p.location, address: p.address || '', description: p.description || '', listing_status: p.listing_status });
      setImages(imgs);
      setCover((imgs.find((i) => i.is_cover) || imgs[0] || {}).image_id || null);
    }).catch(setLoadError).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), []);   // free preview memory

  const addFiles = (list) => {
    const accepted = [];
    for (const file of list) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.error(`"${file.name}" is not a JPG, PNG or WebP image.`); continue; }
      if (file.size > MAX_MB * 1024 * 1024) { toast.error(`"${file.name}" is larger than ${MAX_MB} MB.`); continue; }
      accepted.push({ file, url: URL.createObjectURL(file) });
    }
    setFiles((f) => [...f, ...accepted]);
    form.setErrors((e) => ({ ...e, photos: undefined }));
  };

  const keptCount = images.filter((i) => !remove.includes(i.image_id)).length;
  const isLand = form.values.property_type === 'land';

  const submit = (e) => {
    e.preventDefault();
    form.submit(async (v) => {
      const body = new FormData();
      Object.entries(v).forEach(([k, val]) => body.append(k, val));
      files.forEach((f) => body.append('photos', f.file));
      remove.forEach((rid) => body.append('delete_images', rid));
      if (cover && !remove.includes(cover)) body.append('cover_image', cover);
      const r = editing ? await api.put(`/agent/listings/${id}`, body) : await api.post('/agent/listings', body);
      toast.success(r.message);
      setFiles([]);
      navigate('/agent/listings');
    }, { validate: (v) => validate(v, keptCount + files.length) });
  };

  // Only approved agents may add or edit listings (the API enforces this too).
  if (user.verification_status !== 'approved') return <Navigate to="/agent" replace />;
  if (loading) return <Loading />;
  if (loadError) return <Alert type="error">{loadError.message}</Alert>;

  return (
    <>
      <nav className="small muted mb-4"><Link to="/agent/listings">My listings</Link> / {editing ? 'Edit' : 'New listing'}</nav>
      <div className="page-head"><div><h1>{editing ? 'Edit listing' : 'Add a new listing'}</h1><p>Fields marked <span style={{ color: 'var(--danger)' }}>*</span> are required. Clear photos and an honest description get more viewings.</p></div></div>
      {form.message && <Alert type="error">{form.message}</Alert>}
      <form onSubmit={submit} noValidate className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', alignItems: 'start' }}>
        <div className="card">
          <h2 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>Details</h2>
          <Field label="Title" name="title" required error={form.errors.title}><Input form={form} name="title" maxLength={150} placeholder="e.g. 2-bedroom apartment with garden view" /></Field>
          <div className="form-grid">
            <Field label="Listing type" name="listing_type" required error={form.errors.listing_type}>
              <select className="select" {...form.bind('listing_type')}><option value="">Choose…</option><option value="rent">For rent (price per month)</option><option value="sale">For sale</option></select></Field>
            <Field label="Property type" name="property_type" required error={form.errors.property_type}>
              <select className="select" {...form.bind('property_type')}><option value="">Choose…</option>{Object.entries(PROPERTY_TYPES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Field>
          </div>
          <div className="form-grid">
            <Field label="Price (KES)" name="price" required error={form.errors.price} hint={form.values.price ? `${money(form.values.price)}${form.values.listing_type === 'rent' ? ' per month' : ''}` : 'Digits only'}>
              <Input form={form} name="price" type="digits" maxLength={10} placeholder="85000" /></Field>
            {!isLand && <Field label="Bedrooms" name="bedrooms" required error={form.errors.bedrooms} hint="0 = studio"><Input form={form} name="bedrooms" type="digits" maxLength={2} /></Field>}
            {!isLand && <Field label={form.values.property_type === 'commercial' ? 'Washrooms' : 'Bathrooms'} name="bathrooms" required error={form.errors.bathrooms}><Input form={form} name="bathrooms" type="digits" maxLength={2} /></Field>}
          </div>
          <div className="form-grid">
            <Field label="Location (area, town)" name="location" required error={form.errors.location} hint='Clients search by this. Use "Area, Town".'><Input form={form} name="location" maxLength={100} placeholder="Kilimani, Nairobi" /></Field>
            <Field label="Street address" name="address" error={form.errors.address} hint="Shown only to clients with a confirmed viewing"><Input form={form} name="address" maxLength={255} /></Field>
          </div>
          <Field label="Description" name="description" error={form.errors.description}><TextArea form={form} name="description" maxLength={5000} rows={7} placeholder="Size, finishes, parking, water and power backup, security, nearby schools, deposit terms…" /></Field>
          {editing && (
            <Field label="Status" name="listing_status" hint="Sold or Rented cancels upcoming viewings automatically.">
              <select className="select" {...form.bind('listing_status')}>{Object.entries(LISTING_STATUSES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
            </Field>
          )}
        </div>

        <div>
          <div className="card">
            <h2 className="card-title" style={{ fontSize: 'var(--text-lg)' }}>Photos <span className="small muted" style={{ fontWeight: 400 }}>{keptCount + files.length} / {MAX_PHOTOS}</span></h2>
            {images.length > 0 && (
              <div className="photo-grid mb-4">
                {images.map((img) => (
                  <div key={img.image_id} className={`photo-tile ${cover === img.image_id ? 'cover' : ''} ${remove.includes(img.image_id) ? 'remove' : ''}`}>
                    <img src={img.image_url} alt="" />
                    <div className="opts">
                      <label className="check"><input type="radio" name="cover" checked={cover === img.image_id} onChange={() => setCover(img.image_id)} />Cover</label>
                      <label className="check" style={{ color: 'var(--danger)' }}><input type="checkbox" checked={remove.includes(img.image_id)} onChange={(e) => setRemove((r) => (e.target.checked ? [...r, img.image_id] : r.filter((x) => x !== img.image_id)))} />Delete</label>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div
              className={`dropzone ${dragOver ? 'over' : ''}`} role="button" tabIndex={0}
              onClick={() => fileRef.current.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            >
              <Icon name="camera" size={28} />
              <div className="bold mt-2" style={{ color: 'var(--ink)' }}>Drop photos here or click to choose</div>
              <div className="xsmall">JPG, PNG or WebP · max {MAX_MB} MB each</div>
            </div>
            <input ref={fileRef} id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            {form.errors.photos && <p className="field-error mt-2" id="photos-error">{form.errors.photos}</p>}
            {files.length > 0 && (
              <div className="photo-grid mt-4">
                {files.map((f, i) => (
                  <div key={f.url} className="photo-tile">
                    <img src={f.url} alt="" />
                    <div className="opts"><button type="button" className="btn-link xsmall" onClick={() => setFiles((list) => list.filter((_, j) => j !== i))}>Remove</button></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card">
            <SubmitButton busy={form.submitting} className="btn btn-primary btn-block" busyText="Saving…">{editing ? 'Save changes' : 'Publish listing'}</SubmitButton>
            <Link to="/agent/listings" className="btn btn-link btn-block mt-2">Cancel</Link>
          </div>
        </div>
      </form>
    </>
  );
}
