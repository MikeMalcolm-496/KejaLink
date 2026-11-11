/**
 * Help: searchable help centre. Every panel page has a "?" button that
 * links here with an anchor (#agent-listings, #reports, ...).
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from '../components/Icon';
import useTitle from '../hooks/useTitle';

const SECTIONS = [
  ['start', 'Getting started', 'flag', [
    'KejaLink connects people looking for a home with licensed, verified agents. There are four kinds of account:',
    ['Client: search, save, ask agents questions and book viewings. Free.', 'Agent: list properties and manage inquiries and viewings, once an admin verifies the licence.', 'Admin: verify agents, moderate users and listings, run reports.', 'Super admin: everything an admin can do, plus create or remove administrators.'],
    'To create an account, click Register at the top right, choose Client or Agent, and fill in the form.',
  ]],
  ['search', 'Searching for property', 'search', [
    ['Open Browse. Press the / key to jump to the location box.', 'Filter by location, listing type, property type, price range and bedrooms, then click Search.', 'Each active filter shows as a chip: click it to remove that filter.', 'Use Sort by for newest, price or most viewed. Featured listings always come first.', 'Click the heart to save a listing. Find saved homes under Saved.'],
  ]],
  ['booking', 'Booking a viewing', 'calendar', [
    ['Open a listing and find Book a viewing on the right.', 'Pick a date (Monday to Saturday, from tomorrow up to 30 days ahead). Free times load from the server; crossed-out times are taken.', 'Click a time, then Request viewing. The agent is notified straight away.', 'Track it under My viewings. You get a notification when it is confirmed, rescheduled or declined.', 'Can\'t make it? Cancel it so the slot is freed for others.'],
    'You can hold one active viewing per property, and two people can never book the same property at the same time.',
  ]],
  ['inquiries', 'Asking an agent a question', 'message', ['On a listing, write at least 10 characters under Ask the agent and click Send inquiry. Replies appear on the listing, under My inquiries, and as a notification.']],
  ['agent', 'Agent portal: overview', 'id', [
    'After registering, your account shows "Awaiting verification" until an admin checks your licence. You receive an in-app notification when approved.',
    'The dashboard shows active listings, open inquiries, viewings awaiting your reply and this week\'s viewings. Orange numbers in the menu show items waiting for you.',
  ]],
  ['agent-listings', 'Agent: managing listings', 'building', [
    ['Click Add new listing and fill in the title, type, price (digits only), bedrooms, bathrooms and location ("Area, Town").', 'Drop 1 to 10 photos (JPG, PNG or WebP, max 3 MB each) on the photo box. When editing, choose the cover photo or tick photos to delete.', 'Click Publish listing. It appears in search immediately.', 'Change the status from the drop-down in My listings. Sold or Rented cancels upcoming viewings and tells the clients.', 'Delete removes the listing with its photos, viewings and inquiries, after you confirm.'],
  ]],
  ['agent-viewings', 'Agent: viewing requests', 'calendar', [['Confirm accepts the time.', 'Reschedule lets you pick a new date and time and add a note.', 'Decline needs a short reason, which is sent to the client.', 'Mark completed appears once the viewing time has passed.']]],
  ['agent-payments', 'Agent: manual listing payments', 'card', [
    ['Open Payments, or click the star next to a listing.', 'Choose the listing and a package (7 or 30 days), then submit your payment reference.', 'The request stays pending until an administrator checks it. Once approved, the listing receives a Featured badge at the top of search.'],
  ]],
  ['admin', 'Admin panel: overview', 'gauge', ['The overview shows totals, agents awaiting verification (orange border), a moderation search, a report shortcut, charts of viewings and listings, and the latest activity.']],
  ['admin-agents', 'Admin: verifying agents', 'id', ['Open Agent verification. Check each licence number with the Estate Agents Registration Board, then Approve, or Reject with a reason. Approved agents can be revoked later from the Approved tab.']],
  ['admin-users', 'Admin: managing users', 'users', [
    ['Register user creates an account with a temporary password shown once; share it securely. It must be changed at first login.', 'The key button resets a password and shows the temporary password once.', '2FA off helps a user who lost their phone. Confirm their identity first.', 'Suspend blocks login and needs a reason; Reinstate restores access.', 'The bin button deletes the account and its data, after confirmation.', 'Only super admins can manage administrators, under Administrators.'],
  ]],
  ['admin-listings', 'Admin: moderating listings', 'flag', ['Tick Reported only to see listings clients flagged; each reason shows under the title. Remove hides a listing, cancels its viewings and tells the agent why. Restore reverses it. Dismiss closes a report without action.']],
  ['admin-audit', 'Admin: activity log', 'history', ['Every important action (logins, failed logins, listing changes, bookings, payments, admin decisions) is recorded with the user, time, record and IP address. Filter it, and use Export as report for a PDF.']],
  ['reports', 'Reports', 'file', [
    ['Open Reports and choose a report type.', 'Set the date range and click Generate report.', 'Then pick a status, location or role, the Sort by column and direction, and generate again.', 'Download it as PDF (company name, logo, date, page numbers) or Excel (CSV), or print it.'],
    'Agents see reports on their own listings only; admins see the whole platform.',
  ]],
  ['account', 'Your profile', 'user', ['Open the menu under your name, then Profile, to update your name, email and phone. Agents can also edit their agency name and a short bio shown to clients.']],
  ['security', 'Passwords, 2FA and account safety', 'shield', [
    ['Passwords need 8+ characters with upper-case, lower-case and a number. They are stored as one-way hashes, so nobody can read them.', 'If you forget your password, choose Forgot password? on the login page. An administrator will be notified in the app and can provide a temporary password after verifying your identity. Change it at first login.', 'After 5 wrong passwords the account locks for 15 minutes.', 'You are logged out after 30 minutes without activity.', 'Two-factor authentication: menu, then Password & 2FA. Scan the QR code with Google Authenticator and enter the code. From then on each login also asks for a code from your phone.'],
  ]],
];

const FAQ = [
  ['Is KejaLink free for clients?', 'Yes. Searching, saving, asking and booking are free. Agents pay only if they choose to feature a listing.'],
  ['Why is there no "Book a viewing" button?', 'You need a client account, and the property must be Available. Properties under offer, sold or rented take no new viewings.'],
  ['Why was my time slot rejected?', 'Viewings run Monday to Saturday, 09:00 to 16:00, from tomorrow up to 30 days ahead. Someone may also have just taken it; pick another.'],
  ['I registered as an agent but cannot add listings.', 'An admin must verify your licence first. If it was rejected, the reason shows on your dashboard.'],
  ['I forgot my password or my account is locked.', 'Wait 15 minutes if the account is temporarily locked. Otherwise choose Forgot password? on the login page to notify an administrator.'],
  ['I lost the phone with my authenticator app.', 'Contact an administrator; after confirming your identity they can turn off 2FA.'],
  ['How do I report a fake listing?', 'Open it and click "Report this listing" at the bottom of the right-hand column.'],
];

const ERRORS = [
  ['Please correct the highlighted fields.', 'A field is invalid; the message under it says what to fix.'],
  ['Incorrect email or password.', 'Check spelling and Caps Lock. After 5 tries the account locks for 15 minutes.'],
  ['Request blocked for security reasons.', 'Refresh the page and try again.'],
  ['Sorry, that time slot was just taken.', 'Someone booked it moments before you. Choose another time.'],
  ['Your account type cannot do this.', 'Log in with the right kind of account.'],
  ['Cannot reach the server.', 'Check your internet connection and try again.'],
  ['Something went wrong on our side (Reference …)', 'Nothing was half-saved. Try again; if it repeats, send the reference code to support.'],
];

export default function Help() {
  useTitle('Help centre');
  const [term, setTerm] = useState('');
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) setTimeout(() => { const el = document.getElementById(hash.slice(1)); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 50);
  }, [hash]);
  const match = (text) => !term || text.toLowerCase().includes(term.toLowerCase());
  const textOf = (parts) => parts.flat().join(' ');

  return (
    <>
      <div className="page-head"><div><span className="eyebrow">Support</span><h1>Help centre</h1><p>Step-by-step guides for clients, agents and administrators.</p></div></div>
      <div className="help-layout">
        <nav className="help-toc" aria-label="Help topics">
          <label htmlFor="hs" className="small bold mb-2">Search help</label>
          <input id="hs" className="input mb-4" placeholder="e.g. password, booking" value={term} onChange={(e) => setTerm(e.target.value)} />
          {SECTIONS.map(([id, title]) => <a key={id} href={`#${id}`}>{title}</a>)}
          <a href="#faq">FAQ</a><a href="#errors">Error messages</a><a href="#terms">Terms of use</a>
        </nav>
        <div>
          {SECTIONS.filter(([, title, , parts]) => match(title + textOf(parts))).map(([id, title, icon, parts]) => (
            <section key={id} id={id} className="card help-section">
              <h2 style={{ fontSize: 'var(--text-lg)' }}><Icon name={icon} /> {title}</h2>
              {parts.map((part, i) => (Array.isArray(part)
                ? <ol key={i}>{part.map((li) => <li key={li}>{li}</li>)}</ol>
                : <p key={i}>{part}</p>))}
            </section>
          ))}
          <section id="faq" className="card help-section">
            <h2 style={{ fontSize: 'var(--text-lg)' }}><Icon name="help" /> Frequently asked questions</h2>
            {FAQ.filter(([q, a]) => match(q + a)).map(([q, a]) => <details key={q} className="faq"><summary>{q}</summary><p>{a}</p></details>)}
          </section>
          <section id="errors" className="card help-section">
            <h2 style={{ fontSize: 'var(--text-lg)' }}><Icon name="alert" /> Error messages explained</h2>
            <div className="table-wrap"><table className="table"><thead><tr><th>Message</th><th>What to do</th></tr></thead>
              <tbody>{ERRORS.map(([m, d]) => <tr key={m}><td className="bold">{m}</td><td>{d}</td></tr>)}</tbody></table></div>
          </section>
          <section id="terms" className="card help-section">
            <h2 style={{ fontSize: 'var(--text-lg)' }}><Icon name="lock" /> Terms of use &amp; privacy</h2>
            <ul className="small muted">
              <li>Agents must hold a valid EARB licence and may only list properties they are authorised to market.</li>
              <li>Listings must be accurate. Misleading listings are removed and repeat offenders suspended.</li>
              <li>Never pay a "viewing fee" or deposit before seeing a property in person. Report agents who ask.</li>
              <li>We store your name, email and phone to run the service, and share contact details only with the agent of a property you contact or book.</li>
              <li>Activity is logged for security, as described under Activity log.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
