/**
 * KejaLink end-to-end tests (Playwright, real Chromium browser).
 *
 * Run (from KejaLink-JS/): start PostgreSQL with fresh demo data and the API
 * (npm start in backend/, after npm run build in frontend/), then:
 *     node tests/e2e.test.js [screenshot-folder]
 * Prints PASS/FAIL for every test case and saves screenshots.
 */
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:5000';
const SHOTS = process.argv[2] || path.join(__dirname, 'screenshots');
const SEED_IMG = path.join(__dirname, '..', 'frontend', 'public', 'seed');
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, extra = '') => { results.push([ok ? 'PASS' : 'FAIL', name, extra]); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` :: ${extra}` : ''}`); };

function totp(secret) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/\s/g, '')) bits += A.indexOf(c).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8); counter.writeUInt32BE(Math.floor(Date.now() / 30000), 4);
  const h = crypto.createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const o = h[19] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0');
}
/** A Monday-to-Saturday date at least `ahead` days away, in Nairobi. */
function workday(ahead) {
  const d = new Date(Date.now() + 3 * 3600e3); d.setUTCDate(d.getUTCDate() + ahead);
  while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

(async () => {
  const browser = await chromium.launch();
  const open = async (viewport = { width: 1440, height: 900 }) => {
    const ctx = await browser.newContext({ viewport, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => check(`No JS error (${page.url()})`, false, e.message));
    return { ctx, page };
  };
  const shot = (page, name, fullPage = true) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage });
  const toast = async (page) => { await page.waitForSelector('.toast', { timeout: 8000 }).catch(() => {}); const t = await page.locator('.toast').last().innerText().catch(() => ''); await page.evaluate(() => document.querySelectorAll('.toast .close-btn').forEach((b) => b.click())); return t; };
  const alertText = async (page) => (await page.locator('.alert').allInnerTexts()).join(' | ');
  const login = async (page, email, pw = 'Password@123') => {
    await page.goto(`${BASE}/login`);
    await page.fill('#email', email); await page.fill('#password', pw);
    await page.click('button[type=submit]');
    await page.waitForLoadState('networkidle'); await page.waitForTimeout(300);
  };
  const api = (page, method, url, data, headers = { 'X-KejaLink': '1' }) => page.request.fetch(`${BASE}/api${url}`, { method, data, headers });

  // ------------------------------------------------------------ public
  let { ctx, page } = await open();
  await page.goto(BASE); await page.waitForSelector('.listing-card'); await shot(page, '01-home');
  check('T1 Home shows listing cards', (await page.locator('.listing-card').count()) >= 3);
  await page.goto(`${BASE}/listings`); await page.waitForSelector('.listing-card'); await shot(page, '02-search');
  const heading = await page.locator('h2[aria-live]').innerText();
  check('T2 Search lists results with timing', /\d+ listings? found/.test(heading) && /ms/.test(heading), heading);
  await page.fill('#location', 'Kilimani'); await page.selectOption('#listing_type', 'rent'); await page.click('button:has-text("Search")');
  await page.waitForTimeout(700);
  check('T3 Filter by location + rent', (await page.locator('.listing-card').count()) >= 1 && (await page.locator('.listing-card').first().innerText()).includes('Kilimani'));
  check('T4 Active filters show as removable chips', (await page.locator('.chip').count()) === 2);
  await page.click('#min_price'); await page.keyboard.type('12ab3');
  check('T5 Key trapping blocks letters in price', (await page.inputValue('#min_price')) === '123');
  await page.goto(`${BASE}/listings?location=' OR 1=1 --&min_price=1;DROP TABLE users`); await page.waitForTimeout(800);
  check('T6 SQL injection attempt handled safely', (await page.locator('h2[aria-live]').innerText()).startsWith('0 listing'));
  await page.goto(`${BASE}/properties/1`); await page.waitForSelector('.agent-card'); await shot(page, '03-property');
  check('T7 Property page shows verified agent', (await page.locator('.agent-card').innerText()).includes('Verified licence'));
  check('T8 Guest cannot see agent phone', (await page.locator('aside').innerText()).includes('Log in to see phone number'));
  await page.goto(`${BASE}/properties/99999`); await page.waitForTimeout(600);
  check('T9 Missing listing shows 404 page', (await page.locator('h1').innerText()).includes("couldn't find"));
  await page.goto(`${BASE}/help`); await page.fill('#hs', 'mpesa');
  check('T10 Help search filters topics', (await page.locator('.help-section').count()) < 6);
  await shot(page, '04-help', false);
  await page.goto(`${BASE}/admin`); await page.waitForTimeout(600);
  check('T11 Guest is sent to login from admin panel', page.url().includes('/login'));
  await shot(page, '05-login', false);
  await ctx.close();

  // ------------------------------------------------------------ registration
  ({ ctx, page } = await open());
  await page.goto(`${BASE}/register`);
  await page.click('button:has-text("Create account")');
  check('T12 Client-side validation blocks empty form', (await page.locator('.field-error').count()) >= 4);
  await shot(page, '06-register-validation');
  const stamp = String(Date.now()).slice(-6);
  await page.fill('#full_name', 'Test Client'); await page.fill('#email', `test${stamp}@example.com`); await page.fill('#phone', `0799${stamp}`);
  await page.fill('#password', 'Secret123'); await page.fill('#password_confirm', 'Secret123'); await page.check('#terms');
  await page.click('button:has-text("Create account")'); await page.waitForURL('**/listings');
  check('T13 Client registers and is logged in', (await toast(page)).includes('Account created'));
  const dup = await open();
  await dup.page.goto(`${BASE}/register`);
  await dup.page.fill('#full_name', 'Dup User'); await dup.page.fill('#email', 'amina@example.com'); await dup.page.fill('#phone', '0711000999');
  await dup.page.fill('#password', 'Secret123'); await dup.page.fill('#password_confirm', 'Secret123'); await dup.page.check('#terms');
  await dup.page.click('button:has-text("Create account")'); await dup.page.waitForTimeout(800);
  check('T14 Server rejects duplicate email', (await dup.page.locator('#email-error').innerText().catch(() => '')).includes('already exists'));
  await dup.ctx.close();
  const cookieVisible = await page.evaluate(() => document.cookie.includes('kl_session'));
  check('T15 Session cookie is httpOnly (invisible to JavaScript)', !cookieVisible);

  // ------------------------------------------------------------ main transaction
  const day = workday(3);
  await page.goto(`${BASE}/properties/3`); await page.waitForSelector('#date');
  await page.fill('#date', day); await page.waitForSelector('.slot');
  await page.click('.slot:has-text("11:00")');
  await shot(page, '07-booking-slots');
  await page.click('button:has-text("Request viewing at 11:00")');
  check('T16 Client books a viewing', (await toast(page)).includes('Viewing requested'));
  await page.waitForTimeout(500);
  check('T17 Booking panel shows the existing viewing', (await page.locator('#book').innerText()).includes('You have a viewing'));
  await page.fill('#message', '<script>alert(1)</script> Is parking included?');
  await page.click('button:has-text("Send inquiry")');
  check('T18 Inquiry sent', (await toast(page)).includes('Inquiry sent'));
  await page.waitForTimeout(500);
  check('T19 XSS payload shown as text, not run', (await page.locator('#inquire').innerText()).includes('<script>alert(1)</script>'));
  await page.click('.prop-title button[aria-label="Save property"]');
  check('T20 Favourite saved', (await toast(page)).includes('Saved'));
  await page.goto(`${BASE}/client/viewings`); await page.waitForSelector('.req'); await shot(page, '08-client-viewings');
  check('T21 Client sees the booking under My viewings', (await page.locator('.req').first().innerText()).includes('Studio apartment'));
  await ctx.close();

  ({ ctx, page } = await open());
  await login(page, 'david.ochieng@example.com');
  await page.goto(`${BASE}/properties/3`); await page.fill('#date', day); await page.waitForSelector('.slot');
  check('T22 Taken slot is disabled for other clients', await page.locator('.slot:has-text("11:00")').isDisabled());
  let r = await api(page, 'POST', '/properties/3/viewings', { date: day, time: '11:00' });
  check('T23 Server blocks double booking (409)', r.status() === 409 && (await r.json()).error.includes('just taken'));
  const sunday = (() => { let d = new Date(Date.now() + 3 * 3600e3); do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() !== 0); return d.toISOString().slice(0, 10); })();
  r = await api(page, 'GET', `/properties/3/slots?date=${sunday}`);
  check('T24 Sunday viewings rejected', (await r.json()).error.includes('Sunday'));
  r = await api(page, 'POST', '/properties/3/viewings', { date: '2020-01-01', time: '10:00' });
  check('T25 Past dates rejected', r.status() === 422);
  await page.goto(`${BASE}/admin/users`); await page.waitForTimeout(500);
  check('T26 Client gets 403 page on admin route', (await page.locator('h1').innerText()).includes("don't have access"));
  r = await api(page, 'GET', '/admin/users');
  check('T27 API also refuses (403) for client', r.status() === 403);
  r = await api(page, 'POST', '/properties/3/inquiries', { message: 'no csrf header here at all' }, {});
  check('T28 Request without CSRF header is blocked', r.status() === 403 && (await r.json()).error.includes('blocked'));
  await ctx.close();

  // ------------------------------------------------------------ agent
  ({ ctx, page } = await open());
  await login(page, 'brian@skylinerealty.co.ke');
  check('T29 Agent lands on the dashboard', page.url().endsWith('/agent'));
  await page.waitForSelector('.stat'); await shot(page, '09-agent-dashboard');
  await page.goto(`${BASE}/agent/viewings`); await page.waitForSelector('.req');
  await page.locator('.req', { hasText: 'Test Client' }).first().locator('button:has-text("Confirm")').click();
  check('T30 Agent confirms a viewing', (await toast(page)).includes('confirmed'));
  await page.waitForTimeout(400);
  await page.locator('.req', { hasText: 'near SGR' }).first().locator('button:has-text("Reschedule")').click();
  await page.fill('#rdate', workday(5)); await page.selectOption('#rtime', '15:00'); await page.fill('#rnote', 'Afternoon works better');
  await shot(page, '10-agent-reschedule', false);
  await page.click('.modal button:has-text("Reschedule")');
  check('T31 Agent reschedules a viewing', (await toast(page)).includes('rescheduled'));
  await page.goto(`${BASE}/agent/inquiries`); await page.waitForSelector('.card textarea');
  const inq = page.locator('.card', { hasText: 'Is parking included' }).first();
  await inq.locator('textarea').fill('Yes, one parking bay is included.'); await inq.locator('button:has-text("Send reply")').click();
  check('T32 Agent replies to an inquiry', (await toast(page)).includes('Reply sent'));
  await page.goto(`${BASE}/agent/listings/new`); await page.waitForSelector('#title');
  await page.click('button:has-text("Publish listing")');
  check('T33 Listing form validates an empty submit', (await page.locator('.field-error').count()) >= 4);
  await page.fill('#title', 'Test 2-bedroom flat in Kilimani'); await page.selectOption('#listing_type', 'rent'); await page.selectOption('#property_type', 'apartment');
  await page.fill('#price', '70000'); await page.fill('#location', 'Kilimani, Nairobi'); await page.fill('#description', 'Created by the automated test.');
  await page.setInputFiles('#photos', [path.join(SEED_IMG, 'seed-01-1.jpg'), path.join(SEED_IMG, 'seed-01-2.jpg')]);
  await page.waitForTimeout(300); await shot(page, '11-agent-listing-form');
  await page.click('button:has-text("Publish listing")'); await page.waitForURL('**/agent/listings');
  check('T34 Agent publishes a listing with photos', (await toast(page)).includes('Listing published'));
  // A PHP script renamed to .jpg: browser type check bypassed by posting straight to the API
  const fake = await page.request.post(`${BASE}/api/agent/listings`, { headers: { 'X-KejaLink': '1' }, multipart: {
    title: 'Fake image test', listing_type: 'rent', property_type: 'apartment', price: '1000', bedrooms: '1', bathrooms: '1', location: 'Test',
    photos: { name: 'evil.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('<?php echo "hacked"; ?>') } } });
  check('T35 Fake image upload rejected by content check', fake.status() === 422 && (await fake.json()).error.includes('not a JPG'));
  await page.waitForSelector('table'); await shot(page, '12-agent-listings');
  await page.goto(`${BASE}/agent/payments?property_id=3`); await page.waitForSelector('#phone'); await shot(page, '13-agent-mpesa-form', false);
  await page.click('button:has-text("Pay with M-Pesa")'); await page.waitForSelector('.mpesa-wait'); await shot(page, '14-agent-mpesa-waiting', false);
  check('T36 Simulated M-Pesa payment succeeds', (await page.waitForSelector('.toast', { timeout: 20000 }).then(() => toast(page))).includes('Payment received'));
  await page.goto(`${BASE}/agent/reports`); await page.click('button:has-text("Generate report")'); await page.waitForSelector('.table');
  await shot(page, '15-agent-reports');
  check('T37 Agent report shows only own listings', !(await page.locator('.table').innerText()).includes('Karen'));
  r = await api(page, 'GET', '/reports/users');
  check('T38 Agent cannot run admin-only reports', r.status() === 403);
  await ctx.close();

  ({ ctx, page } = await open());
  await login(page, 'kevin@nyumbanirealty.co.ke');
  check('T39 Pending agent sees verification banner', (await alertText(page)).includes('Awaiting verification'));
  await page.goto(`${BASE}/agent/listings/new`); await page.waitForTimeout(400);
  check('T40 Pending agent cannot open the listing form', page.url().endsWith('/agent'));
  r = await api(page, 'POST', '/agent/listings', {});
  check('T41 API refuses listings from pending agents', r.status() === 403);
  await ctx.close();

  // ------------------------------------------------------------ admin
  ({ ctx, page } = await open());
  await login(page, 'admin@kejalink.co.ke');
  await page.waitForSelector('.chart'); await shot(page, '16-admin-overview');
  check('T42 Admin overview with charts', (await page.locator('.chart svg').count()) === 2);
  await page.goto(`${BASE}/admin/agents`); await page.waitForSelector('table'); await shot(page, '17-admin-agents');
  await page.locator('tr', { hasText: 'Kevin Mwangi' }).locator('button:has-text("Approve")').click();
  await shot(page, '18-confirm-dialog', false);
  await page.click('.modal button:has-text("Approve")');
  check('T43 Admin approves an agent', (await toast(page)).includes('approved agent'));
  await page.waitForTimeout(400);
  await page.locator('tr', { hasText: 'Grace Njeri' }).locator('button:has-text("Reject")').click();
  await page.click('.modal button:has-text("Confirm")');
  check('T44 Reason is required to reject', (await page.locator('.modal .field-error').innerText()).includes('at least'));
  await page.fill('#reason', 'Licence not found in the EARB register.'); await page.click('.modal button:has-text("Confirm")');
  check('T45 Admin rejects an agent with a reason', (await toast(page)).includes('rejected'));
  await page.goto(`${BASE}/admin/users`); await page.fill('#uq', 'Mercy'); await page.click('button:has-text("Filter")'); await page.waitForTimeout(600);
  await shot(page, '19-admin-users');
  await page.click('button[aria-label="Reset password for Mercy Wambui"]'); await page.click('.modal button:has-text("Reset password")');
  await page.waitForSelector('.temp-password');
  const temp = ((await page.locator('.temp-password').innerText()).match(/Temporary password: (\S+)/) || [])[1];
  check('T46 Admin resets a password (temporary password shown)', Boolean(temp), temp);
  await page.click('.modal .close-btn');
  await page.goto(`${BASE}/admin/users/new`); await page.selectOption('#role', 'agent');
  await page.fill('#full_name', 'Admin Made Agent'); await page.fill('#email', `made${stamp}@agency.co.ke`); await page.fill('#phone', `0788${stamp}`); await page.fill('#licence_no', `EARB/2026/${stamp.slice(-4)}`);
  await page.click('button:has-text("Create account")'); await page.waitForSelector('.temp-password');
  check('T47 Admin registers a user', (await page.locator('.modal').innerText()).includes('Account created'));
  await page.click('.modal button:has-text("Done")');
  await page.goto(`${BASE}/admin/listings?reported=1`); await page.waitForSelector('table'); await shot(page, '20-admin-listings-reported');
  await page.locator('tr', { hasText: 'Ground-floor shop' }).locator('button:has-text("Remove")').click();
  await page.fill('#reason', 'Agent asked for a viewing fee, against our rules.'); await page.click('.modal button:has-text("Confirm")');
  check('T48 Admin removes a reported listing', (await toast(page)).includes('Listing removed'));
  await page.goto(`${BASE}/admin/reports?type=listings&from=2025-01-01`); await page.waitForSelector('.table'); await shot(page, '21-admin-reports');
  check('T49 Report preview renders rows', (await page.locator('.table tbody tr').count()) > 5);
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.click('a:has-text("PDF")')]);
  const pdfPath = path.join(SHOTS, 'listings-report.pdf'); await pdf.saveAs(pdfPath);
  check('T50 PDF report downloads', fs.readFileSync(pdfPath).subarray(0, 4).toString() === '%PDF');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.click('a:has-text("Excel")')]);
  const csvPath = path.join(SHOTS, 'listings-report.csv'); await csv.saveAs(csvPath);
  check('T51 CSV report downloads', fs.readFileSync(csvPath, 'utf8').includes('Price (KES)'));
  for (const [i, t] of ['viewings', 'inquiries', 'payments', 'users', 'agents', 'audit'].entries()) {
    const res = await api(page, 'GET', `/reports/${t}?format=pdf&sort=x&dir=asc`);
    check(`T${52 + i} PDF ${t} report`, res.status() === 200 && (await res.body()).subarray(0, 4).toString() === '%PDF');
  }
  await page.goto(`${BASE}/admin/audit`); await page.waitForSelector('table'); await shot(page, '22-admin-audit');
  check('T58 Activity log records admin actions', (await page.locator('table').innerText()).includes('Remove listing'));
  await page.goto(`${BASE}/admin/payments`); await page.waitForSelector('table'); await shot(page, '23-admin-payments', false);
  await page.goto(`${BASE}/admin/admins`); await page.waitForTimeout(500);
  check('T59 Plain admin cannot open the super-admin page', (await page.locator('h1').innerText()).includes("don't have access"));
  await ctx.close();

  ({ ctx, page } = await open());
  await login(page, 'superadmin@kejalink.co.ke');
  await page.goto(`${BASE}/admin/admins`); await page.waitForSelector('table'); await shot(page, '24-superadmin-admins', false);
  check('T60 Super admin manages administrators', (await page.locator('h1').innerText()).includes('Administrators'));
  await ctx.close();

  // ------------------------------------------------------------ passwords and access
  ({ ctx, page } = await open());
  await login(page, 'mercy.wambui@example.com', temp);
  check('T61 Temporary password forces a change', page.url().includes('/change-password'));
  await page.goto(`${BASE}/listings`); await page.waitForTimeout(400);
  r = await api(page, 'GET', '/me/favourites');
  check('T62 Forced change cannot be skipped (API refuses)', r.status() === 403);
  await page.goto(`${BASE}/change-password`);
  await page.fill('#password', 'NewPass123'); await page.fill('#password_confirm', 'NewPass123'); await page.click('button:has-text("Save password")');
  check('T63 User sets a new password', (await toast(page)).includes('Password updated'));
  await ctx.close();

  ({ ctx, page } = await open());
  for (let i = 0; i < 5; i++) await login(page, 'sarah.achieng@example.com', `Wrong${i}`);
  check('T64 Account locks after 5 wrong passwords', (await alertText(page)).includes('locked'));
  await login(page, 'sarah.achieng@example.com');
  check('T65 Locked account refuses the right password', (await alertText(page)).includes('Too many failed attempts'));
  await shot(page, '25-lockout', false);
  await page.goto(`${BASE}/forgot-password`); await page.fill('#email', 'sarah.achieng@example.com'); await page.click('button:has-text("Send reset link")');
  await page.waitForSelector('a:has-text("Open the reset link")'); await shot(page, '26-forgot-password', false);
  await page.click('a:has-text("Open the reset link")'); await page.waitForSelector('#password');
  const resetUrl = page.url();
  await page.fill('#password', 'Reset1234'); await page.fill('#password_confirm', 'Reset1234'); await page.click('button:has-text("Save new password")');
  await page.waitForURL('**/login');
  check('T66 Password reset through the e-mailed link', (await alertText(page)).includes('Password changed'));
  await login(page, 'sarah.achieng@example.com', 'Reset1234');
  check('T67 Reset also clears the lockout', page.url().includes('/listings'));
  await page.goto(resetUrl); await page.waitForTimeout(500);
  check('T68 Reset link cannot be reused', (await page.locator('h1').innerText()).includes('invalid or has expired'));
  await ctx.close();
  ({ ctx, page } = await open());
  await login(page, 'john.kariuki@example.com');
  check('T69 Suspended user cannot log in', (await alertText(page)).includes('suspended'));
  await ctx.close();

  // ------------------------------------------------------------ 2FA
  ({ ctx, page } = await open());
  await login(page, 'amina@example.com');
  await page.goto(`${BASE}/account/security`); await page.waitForSelector('.qr-box svg'); await shot(page, '27-2fa-setup', false);
  const secret = (await page.locator('.card code').innerText()).replace(/\s/g, '');
  await page.fill('#code', totp(secret)); await page.click('button:has-text("Turn on 2FA")');
  check('T70 2FA turned on with an authenticator code', (await toast(page)).includes('Two-factor authentication is ON'));
  await ctx.close();
  ({ ctx, page } = await open());
  await login(page, 'amina@example.com');
  check('T71 Login asks for the 2FA code', page.url().includes('/two-factor'));
  await shot(page, '28-2fa-login', false);
  await page.fill('#code', '000000'); await page.waitForTimeout(800);
  check('T72 Wrong 2FA code rejected', (await alertText(page)).includes('not correct'));
  await page.fill('#code', totp(secret)); await page.waitForURL('**/listings', { timeout: 8000 }).catch(() => {});
  check('T73 Correct 2FA code logs in', page.url().includes('/listings'), page.url());
  await page.goto(`${BASE}/account/notifications`); await page.waitForTimeout(600);
  check('T74 Notifications page lists updates', (await page.locator('.timeline li').count()) >= 1);
  await page.goto(`${BASE}/client/saved`); await page.waitForTimeout(600); await shot(page, '29-client-saved');
  await page.goto(`${BASE}/client/inquiries`); await page.waitForTimeout(600); await shot(page, '30-client-inquiries');
  await ctx.close();

  // ------------------------------------------------------------ mobile
  ({ ctx, page } = await open({ width: 390, height: 844 }));
  await page.goto(`${BASE}/listings`); await page.waitForSelector('.listing-card'); await shot(page, '31-mobile-search', false);
  check('T75 No horizontal scrolling at phone width', !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));
  await page.click('.menu-toggle');
  check('T76 Mobile menu opens', await page.locator('.main-nav.open').isVisible());
  await ctx.close();

  await browser.close();
  const failed = results.filter((x) => x[0] === 'FAIL');
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(SHOTS, 'results.json'), JSON.stringify(results, null, 1));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(2); });
