import { Link } from 'react-router-dom';

/** HustleHub+ brand mark + wordmark. */
export default function Logo({ to = '/', light = false }) {
  return (
    <Link to={to} className={`logo${light ? ' logo--light' : ''}`} aria-label="HustleHub+ home">
      <svg className="logo__mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="currentColor" />
        <path d="M18 16h8v13h12V16h8v32h-8V36H26v12h-8z" fill="#fff" />
        <path d="M51 9v10M46 14h10" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <span className="logo__text">
        HustleHub<span>+</span>
      </span>
    </Link>
  );
}
