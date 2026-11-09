import './styles/landing.css';

const properties = [
  {
    name: 'Kilimani Heights',
    location: 'Kilimani, Nairobi',
    type: 'Apartment',
    price: 185000,
    beds: 2,
    baths: 2,
    area: '980 sq ft',
    status: 'For rent',
    image: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
    tag: 'Verified',
  },
  {
    name: 'Muthaiga Grove',
    location: 'Muthaiga, Nairobi',
    type: 'Villa',
    price: 460000,
    beds: 4,
    baths: 3,
    area: '2,600 sq ft',
    status: 'For sale',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
    tag: 'Popular',
  },
  {
    name: 'Westlands Corner',
    location: 'Westlands, Nairobi',
    type: 'Studio',
    price: 98000,
    beds: 1,
    baths: 1,
    area: '540 sq ft',
    status: 'For rent',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
    tag: 'New',
  },
  {
    name: 'Karen Retreat',
    location: 'Karen, Nairobi',
    type: 'Townhouse',
    price: 625000,
    beds: 3,
    baths: 2,
    area: '1,820 sq ft',
    status: 'For sale',
    image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80',
    tag: 'Featured',
  },
];

const root = document.getElementById('root');

const formatCurrency = (value) => new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
}).format(value);

function renderCards(filtered = properties) {
  return filtered.map((property) => `
    <article class="property-card">
      <div class="property-image" style="background-image: url('${property.image}')">
        <span class="property-tag">${property.tag}</span>
      </div>
      <div class="property-body">
        <div class="property-row">
          <div>
            <h3>${property.name}</h3>
            <p class="property-location">${property.location}</p>
          </div>
          <button class="favorite-btn" type="button" aria-label="Save ${property.name}">♡</button>
        </div>
        <div class="property-meta">
          <span>${property.type}</span>
          <span>${property.beds} bd</span>
          <span>${property.baths} ba</span>
          <span>${property.area}</span>
        </div>
        <div class="property-footer">
          <div>
            <strong>${formatCurrency(property.price)}</strong>
            <span>${property.status}</span>
          </div>
          <button class="primary-btn" type="button">View details</button>
        </div>
      </div>
    </article>
  `).join('');
}

function render() {
  const searchTerm = document.getElementById('searchTerm')?.value?.toLowerCase() || '';
  const typeFilter = document.getElementById('typeFilter')?.value || 'all';

  const filtered = properties.filter((property) => {
    const matchesSearch = property.name.toLowerCase().includes(searchTerm) || property.location.toLowerCase().includes(searchTerm);
    const matchesType = typeFilter === 'all' || property.type === typeFilter;
    return matchesSearch && matchesType;
  });

  root.innerHTML = `
    <div class="page-shell">
      <header class="topbar">
        <div class="brand-wrap">
          <div class="brand-mark">K</div>
          <div>
            <span class="brand-name">KejaLink</span>
            <small>Property marketplace</small>
          </div>
        </div>

        <nav class="main-nav" aria-label="Main navigation">
          <a href="#home">Home</a>
          <a href="#properties">Properties</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>

        <div class="nav-actions">
          <button type="button" class="ghost-btn">Log in</button>
          <button type="button" class="primary-btn">Book a tour</button>
        </div>
      </header>

      <main>
        <section class="hero" id="home">
          <div class="hero-copy">
            <p class="eyebrow">Trusted homes in Kenya</p>
            <h1>Find a property that fits your next chapter.</h1>
            <p class="hero-text">Browse verified listings, compare neighborhoods, and book viewings with licensed agents across Nairobi and the wider Kenyan market.</p>

            <div class="search-panel" aria-label="Search properties">
              <div class="search-field search-lg">
                <label for="searchTerm">Location or property</label>
                <input id="searchTerm" type="text" placeholder="Search e.g. Karen, studio, 2 bed" value="${searchTerm}">
              </div>
              <div class="search-field">
                <label for="typeFilter">Property type</label>
                <select id="typeFilter">
                  <option value="all" ${typeFilter === 'all' ? 'selected' : ''}>All</option>
                  <option value="Apartment" ${typeFilter === 'Apartment' ? 'selected' : ''}>Apartment</option>
                  <option value="Villa" ${typeFilter === 'Villa' ? 'selected' : ''}>Villa</option>
                  <option value="Studio" ${typeFilter === 'Studio' ? 'selected' : ''}>Studio</option>
                  <option value="Townhouse" ${typeFilter === 'Townhouse' ? 'selected' : ''}>Townhouse</option>
                </select>
              </div>
              <button type="button" class="primary-btn cta-btn">Search homes</button>
            </div>

            <ul class="stat-row" aria-label="Key platform statistics">
              <li><strong>1.2k+</strong><span>Verified listings</span></li>
              <li><strong>98%</strong><span>Client satisfaction</span></li>
              <li><strong>24/7</strong><span>Agent support</span></li>
            </ul>
          </div>

          <div class="hero-visual" aria-label="Featured property showcase">
            <div class="featured-card">
              <div class="featured-image"></div>
              <div class="featured-details">
                <div>
                  <small>Featured home</small>
                  <h2>Skyline Residence</h2>
                </div>
                <span class="price-pill">KES 280,000 / month</span>
              </div>
            </div>
          </div>
        </section>

        <section class="info-strip" id="about">
          <div>
            <span>100% verified</span>
            <strong>Licensed agents only</strong>
          </div>
          <div>
            <span>Fast booking</span>
            <strong>Book viewings in minutes</strong>
          </div>
          <div>
            <span>Smart search</span>
            <strong>Find homes by budget and lifestyle</strong>
          </div>
        </section>

        <section class="listings" id="properties">
          <div class="section-heading">
            <div>
              <p class="eyebrow">New on the market</p>
              <h2>Handpicked homes for every lifestyle</h2>
            </div>
            <a href="#" class="text-link">Browse all listings</a>
          </div>

          <div class="property-grid">
            ${renderCards(filtered)}
          </div>
        </section>

        <section class="feature-grid">
          <article>
            <span class="feature-icon">01</span>
            <h3>Search with confidence</h3>
            <p>Filter by neighborhood, price, bedrooms, and property type to narrow down the right fit.</p>
          </article>
          <article>
            <span class="feature-icon">02</span>
            <h3>Book virtual or in-person tours</h3>
            <p>Pick available dates and see a reliable timeline before you travel to the property.</p>
          </article>
          <article>
            <span class="feature-icon">03</span>
            <h3>Connected to trusted agents</h3>
            <p>Each listing comes from licensed experts who understand the local market and your needs.</p>
          </article>
        </section>
      </main>

      <footer class="site-footer" id="contact">
        <div>
          <span class="brand-name">KejaLink</span>
          <p>Helping Kenyan renters, buyers, and investors find the right home.</p>
        </div>
        <div class="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Support</a>
        </div>
      </footer>
    </div>
  `;

  const searchInput = document.getElementById('searchTerm');
  const typeInput = document.getElementById('typeFilter');

  if (searchInput) {
    searchInput.addEventListener('input', render);
  }

  if (typeInput) {
    typeInput.addEventListener('change', render);
  }

  document.querySelectorAll('.favorite-btn').forEach((button) => {
    button.addEventListener('click', () => {
      button.textContent = button.textContent === '♡' ? '♥' : '♡';
      button.classList.toggle('active');
    });
  });
}

render();
