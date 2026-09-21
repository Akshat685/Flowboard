import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError)
      return (
        <main className="page">
          <div
            className="empty-state"
            role="alert"
            style={{ paddingTop: 'clamp(48px, 12vw, 120px)' }}
          >
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
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h1 style={{ fontSize: 'var(--text-3xl)' }}>Something went wrong</h1>
            <p>An unexpected error occurred. Your data is safe.</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </main>
      );
    return this.props.children;
  }
}
