import { api } from '../api/client';
import '../styles/landing.css';
import './styles.css';

const TYPES = { apartment: 'Apartment', house: 'House', land: 'Land', commercial: 'Commercial' };
const rootPath = window.location.pathname.replace(/\/+$/, '') || '/';
const viewName = rootPath === '/' ? 'home' : rootPath === '/listings' ? 'listings' : rootPath === '/help' ? 'help' : 'property';
let root;
let view;
let currentUser = null;
let propertyData = null;
let slotState = { date: '', slots: null, time: '' };
let lightboxIndex = 0;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const money = (value) => `KES ${Math.round(Number(value || 0)).toLocaleString('en-KE')}`;
const imageUrl = (value) => value || '/seed/placeholder.svg';
const dateInNairobi = (offset = 0) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const dateTime = (value) => value
  ? new Date(value).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Nairobi',
  })
  : '-';
const isFeatured = (property) => Boolean(property.featured_until && new Date(property.featured_until) > new Date());
const specs = (property) => {
  if (property.property_type === 'land') return 'Land';
  if (property.property_type === 'commercial') return `Commercial · ${property.bathrooms} washroom${property.bathrooms === 1 ? '' : 's'}`;
  return `${property.bedrooms === 0 ? 'Studio' : `${property.bedrooms} bed`} · ${property.bathrooms} bath`;
};

function showMessage(message, type = 'error') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(() => toast.remove(), 5000);
}

function errorText(error) {
  return error?.message || 'Something went wrong. Please try again.';
}

function showPageError(container, error, {
  notFoundTitle = "We couldn't find this listing",
  errorTitle = "We couldn't load this page",
} = {}) {
  const heading = error?.status === 404 ? notFoundTitle : errorTitle;
  container.innerHTML = `<div class="page-message page-error" role="alert">
    <h2>${heading}</h2>
    <p>${escapeHtml(errorText(error))}</p>
    <button class="ghost-btn" type="button" data-action="reload">Try again</button>
  </div>`;
}

function renderHeader() {
  const actions = document.getElementById('nav-actions');
  const nav = document.querySelector('.main-nav');
  if (!actions || !nav) return;
  const links = [['/', 'Home'], ['/listings', 'Browse homes'], ['/help', 'Help']];
  if (currentUser?.role === 'client') {
    links.splice(2, 0, ['/client/saved', 'Saved homes'], ['/client/viewings', 'My viewings']);
  } else if (currentUser?.role === 'agent') {
    links.splice(2, 0, ['/agent', 'Agent portal']);
  } else if (currentUser && ['admin', 'super_admin'].includes(currentUser.role)) {
    links.splice(2, 0, ['/admin', 'Admin panel']);
  }
  nav.innerHTML = links.map(([href, label]) => `<a href="${href}"${href === rootPath ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  if (!currentUser) {
    actions.innerHTML = '<a class="ghost-btn" href="/login">Log in</a><a class="primary-btn" href="/register">Create account</a>';
    return;
  }
  const name = escapeHtml(currentUser.full_name || 'Account');
  actions.innerHTML = `<a class="account-link" href="/account/profile">${name}</a>
    <button class="ghost-btn" type="button" data-action="logout">Log out</button>`;
}

function propertyCard(property) {
  const id = encodeURIComponent(property.property_id);
  const tags = [
    `<span class="property-tag">For ${escapeHtml(property.listing_type)}</span>`,
    isFeatured(property) ? '<span class="property-tag property-tag-featured">★ Featured</span>' : '',
    property.listing_status === 'under_offer' ? '<span class="property-tag property-tag-offer">Under offer</span>' : '',
  ].join('');
  const favorite = !currentUser || currentUser.role === 'client'
    ? `<button class="favorite-btn${property.is_saved ? ' active' : ''}" type="button" data-action="favorite" data-id="${id}" aria-pressed="${Boolean(property.is_saved)}" aria-label="${property.is_saved ? 'Remove from saved' : 'Save property'}">♡</button>`
    : '';
  return `<article class="property-card">
    <a class="property-image-link" href="/properties/${id}" aria-label="View ${escapeHtml(property.title)}">
      <img class="property-image" src="${escapeHtml(imageUrl(property.cover))}" alt="" loading="lazy">
      <span class="property-tags">${tags}</span>
    </a>
    <div class="property-body">
      <div class="property-row">
        <div><p class="property-price">${money(property.price)}${property.listing_type === 'rent' ? '<small> / month</small>' : ''}</p>
          <h2><a href="/properties/${id}">${escapeHtml(property.title)}</a></h2>
          <p class="property-location">${escapeHtml(property.location)}</p></div>
        ${favorite}
      </div>
      <div class="property-meta"><span>${escapeHtml(TYPES[property.property_type] || property.property_type)}</span><span>${escapeHtml(specs(property))}</span></div>
      <div class="property-footer"><span>${escapeHtml(property.listing_status === 'under_offer' ? 'Under offer' : 'Verified listing')}</span><a class="primary-btn" href="/properties/${id}">View details</a></div>
    </div>
  </article>`;
}

function renderProperties(container, properties, emptyText) {
  if (!properties?.length) {
    container.innerHTML = `<div class="page-message">${escapeHtml(emptyText)}</div>`;
    return;
  }
  container.innerHTML = properties.map(propertyCard).join('');
}

async function loadHome() {
  const listingContainer = document.getElementById('featured-listings');
  try {
    const [listings, stats, locations] = await Promise.all([
      api.get('/properties', { per_page: 6 }),
      api.get('/properties/stats'),
      api.get('/properties/locations'),
    ]);
    document.getElementById('stat-listings').textContent = Number(stats.listings).toLocaleString('en-KE');
    document.getElementById('stat-agents').textContent = Number(stats.agents).toLocaleString('en-KE');
    document.getElementById('stat-areas').textContent = Number(stats.areas).toLocaleString('en-KE');
    document.getElementById('home-locations').innerHTML = locations.map((location) => `<option value="${escapeHtml(location)}"></option>`).join('');
    renderProperties(listingContainer, listings.items, 'No available listings yet. Please check back soon.');
  } catch (error) {
    showPageError(listingContainer, error, {
      notFoundTitle: "We couldn't find the listings service",
      errorTitle: "We couldn't load listings",
    });
    ['stat-listings', 'stat-agents', 'stat-areas'].forEach((id) => {
      document.getElementById(id).textContent = '—';
    });
  }
}

function searchParamsFromForm(form) {
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(form).entries()) {
    if (String(value).trim()) params.set(key, String(value).trim());
  }
  return params;
}

async function loadListings() {
  document.title = 'Browse listings · KejaLink';
  const form = document.getElementById('listing-search');
  const params = new URLSearchParams(window.location.search);
  ['location', 'listing_type', 'property_type', 'min_price', 'max_price', 'bedrooms'].forEach((key) => {
    const field = form.elements.namedItem(key);
    if (field) field.value = params.get(key) || '';
  });
  const sort = document.getElementById('listing-sort');
  sort.value = params.get('sort') || 'newest';
  const page = params.get('page') || '1';
  const query = Object.fromEntries(params.entries());
  query.sort = sort.value;
  query.page = page;
  try {
    const [result, locations] = await Promise.all([
      api.get('/properties', query),
      api.get('/properties/locations'),
    ]);
    document.getElementById('filter-locations').innerHTML = locations.map((location) => `<option value="${escapeHtml(location)}"></option>`).join('');
    document.getElementById('listing-count').textContent = `${result.total} listing${result.total === 1 ? '' : 's'} found · ${result.ms} ms`;
    renderProperties(document.getElementById('listing-results'), result.items, 'No listings match your search. Try a nearby area or adjust your filters.');
    renderPagination(result);
  } catch (error) {
    document.getElementById('listing-count').textContent = 'Listings unavailable';
    showPageError(document.getElementById('listing-results'), error, {
      notFoundTitle: "We couldn't find the listings service",
      errorTitle: "We couldn't load listings",
    });
  }
}

function renderPagination(result) {
  const pagination = document.getElementById('listing-pagination');
  if (result.pages <= 1) {
    pagination.innerHTML = '';
    return;
  }
  const params = new URLSearchParams(window.location.search);
  pagination.innerHTML = Array.from({ length: result.pages }, (_, index) => {
    const page = index + 1;
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    return `<a class="page-number${page === result.page ? ' active' : ''}" href="/listings?${escapeHtml(next.toString())}"${page === result.page ? ' aria-current="page"' : ''}>${page}</a>`;
  }).join('');
}

function galleryMarkup(property, images) {
  const photos = images.length ? images : [{ image_url: null }];
  const visible = photos.slice(0, 3);
  return `<div class="detail-gallery${visible.length === 1 ? ' single' : ''}">
    ${visible.map((image, index) => `<button type="button" data-action="open-photo" data-index="${index}" aria-label="Open photo ${index + 1}">
      <img src="${escapeHtml(imageUrl(image.image_url))}" alt="${index === 0 ? escapeHtml(property.title) : ''}" loading="${index ? 'lazy' : 'eager'}">
    </button>`).join('')}
  </div>`;
}

function rentCalculator(property) {
  const price = Number(property.price);
  if (property.listing_type === 'rent') {
    return `<p>A common guideline is to spend no more than 30% of take-home pay on rent.</p>
      <div class="calculator-results"><div><span>Suggested take-home pay</span><strong>${money(Math.ceil(price / 0.3 / 1000) * 1000)}</strong></div>
      <div><span>Estimated move-in (deposit + first month)</span><strong>${money(price * 2)}</strong></div></div>`;
  }
  return `<div class="calculator-fields">
      <label>Deposit (%)<input class="calculator-input" type="number" min="0" max="90" value="20" data-calc="deposit"></label>
      <label>Interest (% a year)<input class="calculator-input" type="number" min="1" max="30" step="0.1" value="13" data-calc="rate"></label>
      <label>Years<input class="calculator-input" type="number" min="1" max="30" value="20" data-calc="years"></label>
    </div>
    <div class="calculator-results"><div><span>Estimated monthly repayment</span><strong id="mortgage-result"></strong></div></div>
    <p class="small-note">Indicative only. Banks set the real rate and terms.</p>`;
}

function renderProperty(data) {
  propertyData = data;
  const { property: p, images = [], isSaved, myViewing, myInquiries = [], similar = [] } = data;
  const photos = images.length ? images : [{ image_url: null }];
  document.title = `${p.title} · KejaLink`;
  document.getElementById('property-breadcrumb').innerHTML = `<a href="/listings?location=${encodeURIComponent(p.location)}">${escapeHtml(p.location)}</a> / ${escapeHtml(p.title)}`;
  const favorite = !currentUser || currentUser.role === 'client'
    ? `<button class="ghost-btn detail-favorite${isSaved ? ' active' : ''}" type="button" data-action="favorite" data-id="${escapeHtml(p.property_id)}" aria-pressed="${Boolean(isSaved)}">${isSaved ? '♥ Saved' : '♡ Save listing'}</button>`
    : '';
  const booking = !currentUser
    ? `<p>Log in or create a free client account to book.</p><a class="primary-btn full-width" href="/login?from=${encodeURIComponent(window.location.pathname)}">Log in to book</a>`
    : currentUser.role !== 'client'
      ? '<p>Viewings are booked from client accounts.</p>'
      : myViewing
        ? `<p class="success-note">You have a viewing on <strong>${escapeHtml(dateTime(myViewing.scheduled_at))}</strong> (${escapeHtml(myViewing.viewing_status)}).</p><a class="ghost-btn full-width" href="/client/viewings">Manage my viewings</a>`
        : p.listing_status !== 'available'
          ? `<p>This property is ${escapeHtml(p.listing_status.replace(/_/g, ' '))} and is not taking new viewings.</p>`
          : `<form id="booking-form">
              <label for="viewing-date">Date</label>
              <input id="viewing-date" name="date" type="date" min="${dateInNairobi(1)}" max="${dateInNairobi(30)}" required>
              <fieldset class="slot-fieldset"><legend>Available times</legend><div id="viewing-slots"><p>Choose a date to see available times.</p></div></fieldset>
              <button class="primary-btn full-width" type="submit" id="book-button" disabled>Request viewing</button>
            </form>`;
  const inquiry = !currentUser
    ? '<a class="ghost-btn full-width" href="/login">Log in to send an inquiry</a>'
    : currentUser.role !== 'client'
      ? '<p>Inquiries are sent from client accounts.</p>'
      : `<div id="inquiry-history">${myInquiries.map((item) => `<div class="inquiry-message"><p><strong>You:</strong> ${escapeHtml(item.message)}</p>${item.agent_reply ? `<p class="agent-reply"><strong>Agent:</strong> ${escapeHtml(item.agent_reply)}</p>` : '<small>Awaiting reply</small>'}</div>`).join('')}</div>
        <form id="inquiry-form"><label for="inquiry-message">Your question</label><textarea id="inquiry-message" name="message" rows="3" minlength="10" maxlength="2000" placeholder="e.g. Is the deposit negotiable? Is parking included?" required></textarea>
        <button class="ghost-btn full-width" type="submit">Send inquiry</button></form>`;
  const status = p.listing_status.replace(/_/g, ' ');
  const mapQuery = encodeURIComponent(`${p.address ? `${p.address}, ` : ''}${p.location}, Kenya`);
  const isClient = currentUser?.role === 'client';
  document.getElementById('property-content').innerHTML = `
    ${p.listing_status === 'removed' ? '<p class="error-note">This listing was removed by an administrator and is hidden from the public.</p>' : ''}
    ${galleryMarkup(p, photos)}
    <div class="property-detail-layout">
      <div class="property-detail-main">
        <div class="detail-title">
          <div class="detail-badges"><span class="property-tag">For ${escapeHtml(p.listing_type)}</span><span class="property-tag">${escapeHtml(status)}</span>${isFeatured(p) ? '<span class="property-tag property-tag-featured">★ Featured</span>' : ''}</div>
          <h1>${escapeHtml(p.title)}</h1>
          <div class="detail-price-row"><div><strong class="detail-price">${money(p.price)}${p.listing_type === 'rent' ? '<small> / month</small>' : ''}</strong><p>${escapeHtml(p.location)}${p.address ? ` · ${escapeHtml(p.address)}` : ''}</p></div>
            <div class="detail-actions">${favorite}<button class="ghost-btn" type="button" data-action="share">Share</button>
              ${p.is_owner ? `<a class="ghost-btn" href="/agent/listings/${encodeURIComponent(p.property_id)}/edit">Edit listing</a>` : ''}
              ${currentUser && ['admin', 'super_admin'].includes(currentUser.role) ? `<a class="ghost-btn" href="/admin/listings?q=${encodeURIComponent(p.title)}">Moderate</a>` : ''}
            </div></div>
        </div>
        <div class="detail-specs"><div><span>Type</span><strong>${escapeHtml(TYPES[p.property_type] || p.property_type)}</strong></div>
          ${!['land', 'commercial'].includes(p.property_type) ? `<div><span>Bedrooms</span><strong>${p.bedrooms === 0 ? 'Studio' : escapeHtml(p.bedrooms)}</strong></div>` : ''}
          ${p.property_type !== 'land' ? `<div><span>${p.property_type === 'commercial' ? 'Washrooms' : 'Bathrooms'}</span><strong>${escapeHtml(p.bathrooms)}</strong></div>` : ''}
          <div><span>Listed</span><strong>${new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' })}</strong></div>
          <div><span>Views</span><strong>${Number(p.views_count || 0).toLocaleString('en-KE')}</strong></div>
        </div>
        <section class="detail-card"><h2>About this property</h2><p class="description">${escapeHtml(p.description || 'The agent has not added a description yet. Send an inquiry for details.')}</p></section>
        <section class="detail-card"><h2>Location</h2><iframe class="property-map" title="Map of ${escapeHtml(p.location)}" loading="lazy" src="https://maps.google.com/maps?q=${mapQuery}&z=14&output=embed"></iframe><p class="small-note">Shows the general area. The exact address is shared once your viewing is confirmed.</p></section>
        <section class="detail-card"><h2>${p.listing_type === 'rent' ? 'Can I afford this rent?' : 'Mortgage estimate'}</h2>${rentCalculator(p)}</section>
      </div>
      <aside class="property-detail-aside">
        <section class="detail-card agent-card">
          <div class="agent-avatar" aria-hidden="true">${escapeHtml((p.agent_name || 'A').charAt(0).toUpperCase())}</div>
          <div><h2>${escapeHtml(p.agent_name)}</h2><p>${escapeHtml(p.agency_name || 'Independent agent')}</p><span class="verified-label">✓ Verified licence ${escapeHtml(p.licence_no)}</span></div>
          ${p.agent_bio ? `<p>${escapeHtml(p.agent_bio)}</p>` : ''}
          <p class="small-note">${Number(p.agent_listing_count || 0)} listing${p.agent_listing_count === 1 ? '' : 's'} on KejaLink</p>
          ${p.agent_phone ? `<a class="ghost-btn full-width" href="tel:${escapeHtml(p.agent_phone)}">Call ${escapeHtml(p.agent_phone)}</a>` : '<a class="ghost-btn full-width" href="/login">Log in to see phone number</a>'}
        </section>
        <section class="detail-card" id="book"><h2>Book a viewing</h2>${booking}</section>
        <section class="detail-card" id="inquire"><h2>Ask the agent</h2>${inquiry}</section>
        ${isClient ? '<button class="text-link report-link" type="button" data-action="report">Report this listing</button>' : ''}
      </aside>
    </div>
    ${similar.length ? `<section class="listings similar-listings"><div class="section-heading"><h2>Similar listings</h2></div><div class="property-grid">${similar.map(propertyCard).join('')}</div></section>` : ''}
    <dialog id="photo-dialog" class="photo-dialog"><button class="dialog-close" type="button" data-action="close-photo" aria-label="Close photo">×</button><button class="photo-prev" type="button" data-action="previous-photo" aria-label="Previous photo">‹</button><img id="lightbox-photo" alt=""><button class="photo-next" type="button" data-action="next-photo" aria-label="Next photo">›</button><p id="photo-count"></p></dialog>
    ${isClient ? `<dialog id="report-dialog" class="form-dialog"><form id="report-form"><button class="dialog-close" type="button" data-action="close-report" aria-label="Close">×</button><h2>Report this listing</h2><p>Administrators review every report. Please describe the issue with this listing.</p><label for="report-reason">What’s wrong?</label><textarea id="report-reason" name="reason" minlength="10" maxlength="255" required></textarea><div class="dialog-actions"><button class="ghost-btn" type="button" data-action="close-report">Cancel</button><button class="primary-btn" type="submit">Send report</button></div></form></dialog>` : ''}`;
  updateMortgage();
  if (slotState.date && currentUser?.role === 'client' && !myViewing && p.listing_status === 'available') loadSlots(slotState.date);
}

async function loadProperty() {
  const id = decodeURIComponent(rootPath.split('/')[2] || '');
  try {
    const data = await api.get(`/properties/${encodeURIComponent(id)}`);
    slotState = { date: '', slots: null, time: '' };
    renderProperty(data);
  } catch (error) {
    showPageError(document.getElementById('property-content'), error);
  }
}

async function loadSlots(date) {
  const target = document.getElementById('viewing-slots');
  if (!target) return;
  if (!date) {
    slotState = { date: '', slots: null, time: '' };
    target.innerHTML = '<p>Choose a date to see available times.</p>';
    const submit = document.getElementById('book-button');
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Request viewing';
    }
    return;
  }
  const submit = document.getElementById('book-button');
  if (submit) submit.disabled = true;
  target.innerHTML = '<p>Loading available times…</p>';
  slotState = { date, slots: null, time: '' };
  try {
    const result = await api.get(`/properties/${encodeURIComponent(propertyData.property.property_id)}/slots`, { date });
    slotState.slots = result.slots;
    target.innerHTML = `<div class="slot-grid">${Object.entries(result.slots).map(([time, taken]) =>
      `<button class="slot-button${taken ? ' taken' : ''}" type="button" data-action="select-slot" data-time="${escapeHtml(time)}" ${taken ? 'disabled' : ''} aria-pressed="false">${escapeHtml(time)}${taken ? ' · taken' : ''}</button>`,
    ).join('')}</div>`;
  } catch (error) {
    target.innerHTML = `<p class="error-note" role="alert">${escapeHtml(errorText(error))}</p>`;
  }
}

function updateMortgage() {
  const result = document.getElementById('mortgage-result');
  if (!result || !propertyData) return;
  const price = Number(propertyData.property.price);
  const deposit = Number(document.querySelector('[data-calc="deposit"]')?.value || 20);
  const rate = Number(document.querySelector('[data-calc="rate"]')?.value || 13) / 100 / 12;
  const months = Number(document.querySelector('[data-calc="years"]')?.value || 20) * 12;
  const loan = price * (1 - deposit / 100);
  const payment = rate > 0 ? (loan * rate) / (1 - (1 + rate) ** -months) : loan / months;
  result.textContent = Number.isFinite(payment) && payment > 0 ? `${money(payment)} / month` : '—';
}

async function toggleFavorite(button) {
  if (!currentUser) {
    window.location.assign(`/login?from=${encodeURIComponent(window.location.pathname)}`);
    return;
  }
  if (currentUser.role !== 'client') return;
  button.disabled = true;
  try {
    const response = await api.post(`/properties/${encodeURIComponent(button.dataset.id)}/favourite`);
    button.classList.toggle('active', response.saved);
    button.setAttribute('aria-pressed', String(response.saved));
    if (button.classList.contains('detail-favorite')) button.textContent = response.saved ? '♥ Saved' : '♡ Save listing';
    showMessage(response.saved ? 'Saved to your favourites.' : 'Removed from your favourites.', 'success');
  } catch (error) {
    showMessage(errorText(error));
  } finally {
    button.disabled = false;
  }
}

function openPhoto(index) {
  const dialog = document.getElementById('photo-dialog');
  if (!dialog || !propertyData) return;
  const photos = propertyData.images?.length ? propertyData.images : [{ image_url: null }];
  lightboxIndex = (index + photos.length) % photos.length;
  document.getElementById('lightbox-photo').src = imageUrl(photos[lightboxIndex].image_url);
  document.getElementById('lightbox-photo').alt = `${propertyData.property.title}, photo ${lightboxIndex + 1}`;
  document.getElementById('photo-count').textContent = `${lightboxIndex + 1} / ${photos.length} · use ← → keys`;
  if (!dialog.open) dialog.showModal();
  for (const button of dialog.querySelectorAll('.photo-prev, .photo-next')) button.hidden = photos.length < 2;
}

function movePhoto(direction) {
  const photos = propertyData?.images?.length ? propertyData.images : [{ image_url: null }];
  openPhoto((lightboxIndex + direction + photos.length) % photos.length);
}

async function handleSubmit(event) {
  const form = event.target;
  if (form.id === 'home-search') {
    event.preventDefault();
    window.location.assign(`/listings?${searchParamsFromForm(form)}`);
    return;
  }
  if (form.id === 'listing-search') {
    event.preventDefault();
    const params = searchParamsFromForm(form);
    const sort = document.getElementById('listing-sort').value;
    if (sort !== 'newest') params.set('sort', sort);
    window.location.assign(`/listings?${params}`);
    return;
  }
  if (form.id === 'booking-form') {
    event.preventDefault();
    if (!slotState.time) {
      showMessage('Choose an available time before requesting a viewing.');
      return;
    }
    const button = document.getElementById('book-button');
    button.disabled = true;
    try {
      const response = await api.post(`/properties/${encodeURIComponent(propertyData.property.property_id)}/viewings`, {
        date: slotState.date,
        time: slotState.time,
      });
      showMessage(response.message, 'success');
      await loadProperty();
    } catch (error) {
      showMessage(errorText(error));
      if (error.status === 409) loadSlots(slotState.date);
    } finally {
      if (document.getElementById('book-button')) document.getElementById('book-button').disabled = false;
    }
    return;
  }
  if (form.id === 'inquiry-form') {
    event.preventDefault();
    const message = new FormData(form).get('message').toString().trim();
    if (message.length < 10) {
      showMessage('Write at least 10 characters.');
      return;
    }
    try {
      const response = await api.post(`/properties/${encodeURIComponent(propertyData.property.property_id)}/inquiries`, { message });
      showMessage(response.message, 'success');
      await loadProperty();
    } catch (error) {
      showMessage(errorText(error));
    }
    return;
  }
  if (form.id === 'report-form') {
    event.preventDefault();
    const reason = new FormData(form).get('reason').toString().trim();
    if (reason.length < 10) {
      showMessage('Describe the problem in at least 10 characters.');
      return;
    }
    try {
      const response = await api.post(`/properties/${encodeURIComponent(propertyData.property.property_id)}/report`, { reason });
      document.getElementById('report-dialog').close();
      showMessage(response.message, 'success');
      form.reset();
    } catch (error) {
      showMessage(errorText(error));
    }
  }
}

async function handleClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action } = button.dataset;
  if (action === 'favorite') await toggleFavorite(button);
  if (action === 'reload') window.location.reload();
  if (action === 'logout') {
    try {
      await api.post('/auth/logout');
      window.location.assign('/');
    } catch (error) {
      showMessage(errorText(error));
    }
  }
  if (action === 'select-slot') {
    slotState.time = button.dataset.time;
    document.querySelectorAll('.slot-button').forEach((slot) => {
      const selected = slot === button;
      slot.classList.toggle('selected', selected);
      slot.setAttribute('aria-pressed', String(selected));
    });
    const submit = document.getElementById('book-button');
    if (submit) {
      submit.disabled = false;
      submit.textContent = `Request viewing at ${slotState.time}`;
    }
  }
  if (action === 'open-photo') openPhoto(Number(button.dataset.index));
  if (action === 'close-photo') document.getElementById('photo-dialog')?.close();
  if (action === 'previous-photo') movePhoto(-1);
  if (action === 'next-photo') movePhoto(1);
  if (action === 'report') document.getElementById('report-dialog')?.showModal();
  if (action === 'close-report') document.getElementById('report-dialog')?.close();
  if (action === 'share') {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showMessage('Link copied. Share it with anyone.', 'success');
    } catch {
      showMessage('Could not copy the link. Copy the address from your browser.');
    }
  }
}

function handleChange(event) {
  if (event.target.id === 'listing-sort') {
    const params = new URLSearchParams(window.location.search);
    params.set('sort', event.target.value);
    params.delete('page');
    window.location.assign(`/listings?${params}`);
  }
  if (event.target.id === 'viewing-date') loadSlots(event.target.value);
  if (event.target.matches('[data-calc]')) updateMortgage();
}

function handleInput(event) {
  if (event.target.id === 'help-search') {
    const term = event.target.value.trim().toLowerCase();
    document.querySelectorAll('[data-searchable]').forEach((section) => {
      section.hidden = term !== '' && !section.textContent.toLowerCase().includes(term);
    });
  }
  if (event.target.matches('[data-calc]')) updateMortgage();
  if (event.target.matches('[inputmode="numeric"]')) event.target.value = event.target.value.replace(/\D/g, '');
}

async function loadLayout() {
  const response = await fetch('/views/layout.html');
  if (!response.ok) throw new Error(`Could not load the page layout (${response.status}).`);
  root.innerHTML = await response.text();
  view = document.getElementById('page-view');
  const pageResponse = await fetch(`/views/${viewName}.html`);
  if (!pageResponse.ok) throw new Error(`Could not load this page (${pageResponse.status}).`);
  view.innerHTML = await pageResponse.text();
  view.addEventListener('submit', (event) => {
    handleSubmit(event).catch((error) => showMessage(errorText(error)));
  });
  root.addEventListener('click', (event) => {
    handleClick(event).catch((error) => showMessage(errorText(error)));
  });
  view.addEventListener('change', handleChange);
  view.addEventListener('input', handleInput);
}

export async function mount(target) {
  root = target;
  document.title = 'KejaLink · Verified homes in Kenya';
  try {
    await loadLayout();
  } catch (error) {
    root.innerHTML = `<main class="startup-error"><h1>KejaLink could not load</h1><p>${escapeHtml(errorText(error))}</p><a href="/">Return home</a></main>`;
    return;
  }
  try {
    const auth = await api.get('/auth/me');
    currentUser = auth.user || null;
  } catch (error) {
    if (error.status !== 401) showMessage(`Account information is unavailable: ${errorText(error)}`);
  }
  try {
    renderHeader();
    if (viewName === 'help') document.title = 'Help centre · KejaLink';
    if (viewName === 'home') await loadHome();
    if (viewName === 'listings') {
      await loadListings();
      const searchBox = document.getElementById('filter-location');
      document.addEventListener('keydown', (event) => {
        if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
          event.preventDefault();
          searchBox.focus();
        }
      });
    }
    if (viewName === 'property') await loadProperty();
  } catch (error) {
    showPageError(view, error);
  }
}
