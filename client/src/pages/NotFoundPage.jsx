import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="page">
      <div className="empty-state" style={{ paddingTop: 'clamp(48px, 12vw, 120px)' }}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ width: '100px', height: '100px' }}
        >
          <path d="M9 9h.01" />
          <path d="M15 9h.01" />
          <path d="M8 13a4 4 0 0 0 8 0" transform="rotate(180 12 13)" />
          <circle cx="12" cy="12" r="10" />
        </svg>
        <h1 style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-3)' }}>
          <span className="gradient-text">404</span>
        </h1>
        <h3>Page not found</h3>
        <p>Check the address or return to your boards.</p>
        <Link to="/boards" className="btn btn-primary">
          Go to boards
        </Link>
      </div>
    </main>
  );
}
