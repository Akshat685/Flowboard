import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/AuthContext';
import { useBoards } from '@/features/boards/hooks/BoardContext';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/utils/errors';

export function Shell() {
  const { user, signOut } = useAuth();
  const { error, clearError, live, loadList, loadBoard } = useBoards();
  const { theme, toggleTheme } = useTheme();
  const [logoutError, setLogoutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="topbar">
        <Link className="brand" to="/boards">
          Flowboard<span> / </span>
        </Link>
        <div className="actions">
          <span className="live-indicator" aria-live="polite">
            <span className={`live-dot${live ? '' : ' offline'}`} aria-hidden="true" />
            {live ? 'Live' : 'Reconnecting'}
          </span>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <span>{user?.name}</span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={signingOut}
            onClick={async () => {
              if (signingOut) return;
              setSigningOut(true);
              setLogoutError('');
              try {
                await signOut();
              } catch (err) {
                setLogoutError(errorMessage(err));
              } finally {
                setSigningOut(false);
              }
            }}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>
      {(error || logoutError) && (
        <div className="error-banner" role="alert">
          <span>{error || logoutError}</span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              clearError();
              setLogoutError('');
              void loadList();
              void loadBoard();
            }}
          >
            Reload
          </button>
        </div>
      )}
      <Outlet />
    </>
  );
}
