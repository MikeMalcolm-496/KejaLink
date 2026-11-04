import { Link } from 'react-router-dom';

export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="brand" aria-label="KejaLink home">
      <img src="/logo.svg" alt="" width="34" height="34" />
      <span>Keja<span className="dot">Link</span></span>
    </Link>
  );
}
