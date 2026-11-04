/**
 * agentController.js: the agent portal: dashboard, listings (FR2) with
 * photos, viewing requests and inquiries (FR4).
 * Every query includes "agent_id = <logged-in agent>" so an agent can only
 * ever see or change their own data.
 */
const { query, queryOne, transaction } = require('../config/db');
const { AppError } = require('../middleware/errors');
const { Validator, toInt } = require('../utils/validator');
const { audit, notify } = require('../utils/audit');
const { saveImage, deleteImages } = require('../utils/storage');
const { COVER } = require('./propertyController');
const viewings = require('../services/viewingService');

const MAX_PHOTOS = 10;
const STATUSES = ['available', 'under_offer', 'sold', 'rented'];

// GET /api/agent/dashboard
async function dashboard(req, res) {
  const id = req.user.user_id;
  const s = await queryOne(`select
    (select count(*) from properties where agent_id = $1 and listing_status in ('available','under_offer'))::int active_listings,
    (select count(*) from inquiries i join properties p on p.property_id = i.property_id where p.agent_id = $1 and i.inquiry_status = 'open')::int open_inquiries,
    (select count(*) from viewings v join properties p on p.property_id = v.property_id where p.agent_id = $1 and v.viewing_status = 'requested')::int awaiting,
    (select count(*) from viewings v join properties p on p.property_id = v.property_id where p.agent_id = $1
       and v.viewing_status in ('confirmed','rescheduled') and date_trunc('week', v.scheduled_at) = date_trunc('week', now()))::int this_week,
    (select coalesce(sum(views_count),0) from properties where agent_id = $1)::int total_views`, [id]);
  const requests = await query(
    `select v.*, p.title, p.location, c.full_name client_name from viewings v
     join properties p on p.property_id = v.property_id join users c on c.user_id = v.client_id
     where p.agent_id = $1 and v.viewing_status in ('requested','confirmed','rescheduled') and v.scheduled_at >= current_date
     order by (v.viewing_status = 'requested') desc, v.scheduled_at limit 5`, [id]);
  const listings = await query(`select p.*, ${COVER} from properties p where agent_id = $1 and listing_status <> 'removed' order by updated_at desc limit 5`, [id]);
  const latestInquiry = await queryOne(
    `select i.*, p.title, c.full_name client_name from inquiries i join properties p on p.property_id = i.property_id
     join users c on c.user_id = i.client_id where p.agent_id = $1 and i.inquiry_status = 'open' order by i.created_at desc limit 1`, [id]);
  res.json({ stats: s, requests, listings, latestInquiry });
}

// GET /api/agent/listings?q=&status=&sort=&dir=&page=
async function listListings(req, res) {
  const params = [req.user.user_id];
  let where = 'p.agent_id = $1';
  if (req.query.q) { params.push(`%${String(req.query.q).slice(0, 100)}%`); where += ` and (p.title ilike $${params.length} or p.location ilike $${params.length})`; }
  if ([...STATUSES, 'removed'].includes(req.query.status)) { params.push(req.query.status); where += ` and p.listing_status = $${params.length}`; }
  const total = Number((await queryOne(`select count(*) n from properties p where ${where}`, params)).n);
  const perPage = 15;
  const page = Math.max(1, toInt(req.query.page, 1));
  const sortCol = { title: 'p.title', price: 'p.price', created: 'p.created_at', views: 'p.views_count', status: 'p.listing_status' }[req.query.sort] || 'p.created_at';
  const dir = req.query.dir === 'asc' ? 'asc' : 'desc';
  params.push(perPage, (page - 1) * perPage);
  const rows = await query(
    `select p.*, ${COVER},
            (select count(*) from viewings v where v.property_id = p.property_id)::int viewings,
            (select count(*) from inquiries i where i.property_id = p.property_id)::int inquiries
     from properties p where ${where} order by ${sortCol} ${dir}, p.property_id desc limit $${params.length - 1} offset $${params.length}`, params);
  res.json({ items: rows, total, page, pages: Math.max(1, Math.ceil(total / perPage)) });
}

async function ownListing(agentId, propertyId) {
  const p = await queryOne("select * from properties where property_id = $1 and agent_id = $2 and listing_status <> 'removed'", [propertyId, agentId]);
  if (!p) throw new AppError(404, 'Listing not found, or it is not yours.');
  return p;
}

// GET /api/agent/listings/:id
async function getListing(req, res) {
  const p = await ownListing(req.user.user_id, toInt(req.params.id));
  const images = await query('select * from property_images where property_id = $1 order by is_cover desc, image_id', [p.property_id]);
  res.json({ property: p, images });
}

function validateListing(body, files, remainingPhotos, isEdit) {
  const isLand = body.property_type === 'land';
  const v = new Validator(body);
  v.required('title', 'Title').length('title', 'Title', 5, 150)
    .required('listing_type', 'Listing type').oneOf('listing_type', ['sale', 'rent'], 'listing type')
    .required('property_type', 'Property type').oneOf('property_type', ['apartment', 'house', 'land', 'commercial'], 'property type')
    .required('price', 'Price').number('price', 'Price', 1, 9999999999)
    .required('location', 'Location').length('location', 'Location', 2, 100)
    .length('address', 'Address', 0, 255).length('description', 'Description', 0, 5000)
    .check('photos', remainingPhotos + files.length === 0, 'Add at least one photo; listings with photos get far more viewings.')
    .check('photos', remainingPhotos + files.length > MAX_PHOTOS, `A listing can have at most ${MAX_PHOTOS} photos.`);
  if (!isLand) v.required('bedrooms', 'Bedrooms').number('bedrooms', 'Bedrooms', 0, 20).required('bathrooms', 'Bathrooms').number('bathrooms', 'Bathrooms', 0, 20);
  if (isEdit) v.oneOf('listing_status', STATUSES, 'status');
  v.throwIfFailed();
  return { v, isLand };
}

/**
 * POST /api/agent/listings and PUT /api/agent/listings/:id (multipart form with photos[])
 * Property row and photo rows are saved in ONE transaction. If anything fails,
 * nothing is saved and photos already uploaded are deleted again.
 */
async function saveListing(req, res) {
  const editId = req.params.id ? toInt(req.params.id) : null;
  const existing = editId ? await ownListing(req.user.user_id, editId) : null;
  const files = req.files || [];
  const deleteIds = [].concat(req.body.delete_images || []).map((x) => toInt(x)).filter(Boolean);
  const currentImages = existing ? await query('select * from property_images where property_id = $1', [editId]) : [];
  const remaining = currentImages.filter((i) => !deleteIds.includes(i.image_id)).length;
  const { v, isLand } = validateListing(req.body, files, remaining, Boolean(existing));

  const uploaded = [];
  let removedUrls = [];
  let declined = 0;
  try {
    for (const f of files) uploaded.push(await saveImage(f));   // checks real file type
    const id = await transaction(async (tx) => {
      const values = [v.value('title'), v.value('description') || null, v.value('listing_type'), v.value('property_type'),
        Number(v.value('price')), isLand ? 0 : toInt(v.value('bedrooms')), isLand ? 0 : toInt(v.value('bathrooms')),
        v.value('location'), v.value('address') || null];
      let pid;
      if (existing) {
        pid = editId;
        const status = v.value('listing_status');
        await tx.query(`update properties set title=$1, description=$2, listing_type=$3, property_type=$4, price=$5, bedrooms=$6,
                          bathrooms=$7, location=$8, address=$9, listing_status=$10 where property_id = $11`, [...values, status, pid]);
        if (['sold', 'rented'].includes(status) && existing.listing_status !== status) {
          declined = await viewings.declineOpenViewings(tx, pid, `The property is now ${status}.`);
        }
      } else {
        pid = (await tx.queryOne(`insert into properties (title, description, listing_type, property_type, price, bedrooms, bathrooms, location, address, agent_id)
                                  values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning property_id`, [...values, req.user.user_id])).property_id;
      }
      if (deleteIds.length) {
        const gone = await tx.query('delete from property_images where property_id = $1 and image_id = any($2::int[]) returning image_url', [pid, deleteIds]);
        removedUrls = gone.map((g) => g.image_url);
      }
      for (const url of uploaded) await tx.query('insert into property_images (property_id, image_url) values ($1, $2)', [pid, url]);
      // Cover photo: the chosen one, otherwise the first.
      await tx.query('update property_images set is_cover = false where property_id = $1', [pid]);
      const cover = toInt(req.body.cover_image);
      const set = await tx.query('update property_images set is_cover = true where property_id = $1 and image_id = $2 returning 1', [pid, cover]);
      if (!set.length) {
        await tx.query('update property_images set is_cover = true where image_id = (select min(image_id) from property_images where property_id = $1)', [pid]);
      }
      return pid;
    });
    await deleteImages(removedUrls);             // remove files only after the transaction committed
    await audit(req, existing ? 'listing_updated' : 'listing_created', 'property', id, v.value('title'));
    res.status(existing ? 200 : 201).json({
      property_id: id,
      message: existing ? `Listing updated.${declined ? ` ${declined} upcoming viewing(s) were cancelled.` : ''}` : 'Listing published. It is now visible to clients.',
    });
  } catch (err) {
    await deleteImages(uploaded);                // recovery: undo uploads if saving failed
    throw err;
  }
}

// PATCH /api/agent/listings/:id/status
async function setStatus(req, res) {
  const p = await ownListing(req.user.user_id, toInt(req.params.id));
  const status = req.body.status;
  if (!STATUSES.includes(status)) throw new AppError(422, 'Choose a valid status.');
  const declined = await transaction(async (tx) => {
    await tx.query('update properties set listing_status = $1 where property_id = $2', [status, p.property_id]);
    return ['sold', 'rented'].includes(status) ? viewings.declineOpenViewings(tx, p.property_id, `The property is now ${status}.`) : 0;
  });
  await audit(req, 'listing_status', 'property', p.property_id, `${p.listing_status} -> ${status}`);
  res.json({ message: `Status changed to ${status.replace('_', ' ')}.${declined ? ` ${declined} upcoming viewing(s) were cancelled and the clients notified.` : ''}` });
}

// DELETE /api/agent/listings/:id
async function deleteListing(req, res) {
  const p = await ownListing(req.user.user_id, toInt(req.params.id));
  const images = await query('select image_url from property_images where property_id = $1', [p.property_id]);
  await query('delete from properties where property_id = $1', [p.property_id]);   // photos, viewings, inquiries cascade
  await deleteImages(images.map((i) => i.image_url));
  await audit(req, 'listing_deleted', 'property', p.property_id, p.title);
  res.json({ message: `Listing "${p.title}" deleted.` });
}

// GET /api/agent/viewings?status=&when=upcoming|past|all&page=
async function listViewings(req, res) {
  const params = [req.user.user_id];
  let where = 'p.agent_id = $1';
  if (['requested', 'confirmed', 'rescheduled', 'declined', 'completed', 'cancelled'].includes(req.query.status)) {
    params.push(req.query.status); where += ` and v.viewing_status = $${params.length}`;
  }
  const when = req.query.when || 'upcoming';
  if (when === 'upcoming') where += ' and v.scheduled_at >= current_date';
  if (when === 'past') where += ' and v.scheduled_at < current_date';
  const rows = await query(
    `select v.*, p.title, p.location, c.full_name client_name, c.phone client_phone, c.email client_email
     from viewings v join properties p on p.property_id = v.property_id join users c on c.user_id = v.client_id
     where ${where} order by v.scheduled_at ${when === 'past' ? 'desc' : 'asc'} limit 200`, params);
  res.json(rows.map((r) => ({ ...r, allowed: viewings.TRANSITIONS[r.viewing_status].agent })));
}

// PATCH /api/agent/viewings/:id  { status, note, date, time }
async function updateViewing(req, res) {
  const status = req.body.status;
  if (!['confirmed', 'rescheduled', 'declined', 'completed'].includes(status)) throw new AppError(422, 'Unknown action.');
  await viewings.changeStatus(req, toInt(req.params.id), status, 'agent',
    { note: req.body.note ? String(req.body.note).trim() : null, date: req.body.date, time: req.body.time });
  const msg = { confirmed: 'Viewing confirmed.', rescheduled: 'Viewing rescheduled.', declined: 'Viewing declined.', completed: 'Viewing marked as completed.' }[status];
  res.json({ message: `${msg} ${status === 'completed' ? '' : 'The client has been notified.'}`.trim() });
}

// GET /api/agent/inquiries?status=open|replied|closed|all
async function listInquiries(req, res) {
  const params = [req.user.user_id];
  let where = 'p.agent_id = $1';
  const status = req.query.status || 'open';
  if (['open', 'replied', 'closed'].includes(status)) { params.push(status); where += ` and i.inquiry_status = $${params.length}`; }
  const rows = await query(
    `select i.*, p.title, p.property_id, c.full_name client_name, c.phone client_phone
     from inquiries i join properties p on p.property_id = i.property_id join users c on c.user_id = i.client_id
     where ${where} order by i.created_at desc limit 200`, params);
  res.json(rows);
}

// PATCH /api/agent/inquiries/:id  { action: 'reply' | 'close', reply }
async function updateInquiry(req, res) {
  const i = await queryOne(`select i.*, p.title from inquiries i join properties p on p.property_id = i.property_id
                            where i.inquiry_id = $1 and p.agent_id = $2`, [toInt(req.params.id), req.user.user_id]);
  if (!i) throw new AppError(404, 'Inquiry not found.');
  if (req.body.action === 'close') {
    await query("update inquiries set inquiry_status = 'closed' where inquiry_id = $1", [i.inquiry_id]);
    await audit(req, 'inquiry_closed', 'inquiry', i.inquiry_id, i.title);
    return res.json({ message: 'Inquiry closed.' });
  }
  const v = new Validator(req.body);
  v.required('reply', 'Reply').length('reply', 'Reply', 2, 1000).throwIfFailed();
  await transaction(async (tx) => {
    await tx.query("update inquiries set agent_reply = $1, inquiry_status = 'replied', replied_at = now() where inquiry_id = $2", [v.value('reply'), i.inquiry_id]);
    await notify(tx, i.client_id, `The agent replied to your question about ${i.title}`, '/client/inquiries');
  });
  await audit(req, 'inquiry_replied', 'inquiry', i.inquiry_id, i.title);
  res.json({ message: 'Reply sent.' });
}

module.exports = { dashboard, listListings, getListing, saveListing, setStatus, deleteListing, listViewings, updateViewing, listInquiries, updateInquiry, MAX_PHOTOS };
