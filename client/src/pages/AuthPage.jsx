import { useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { errorMessage } from '@/utils/errors';

export function AuthPage({ mode }) {
  const { user, signIn, registerAccount } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const register = mode === 'register';

  if (user) return <Navigate to="/boards" replace />;

  return (
    <main className="auth-page">
      <div className="auth-intro">
        <p className="eyebrow">FLOWBOARD / YOUR WORK, IN VIEW</p>
        <h1>
          A little structure.
          <br />A lot more progress.
        </h1>
        <p>Turn a collection of tasks into a clear path forward.</p>
      </div>
      <div style={{ position: 'relative' }}>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          style={{ position: 'absolute', top: '16px', right: '16px' }}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <form
          className="auth-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending.current) return;
            pending.current = true;
            setError('');
            setBusy(true);
            const data = new FormData(event.currentTarget);
            const input = {
              email: String(data.get('email') ?? ''),
              password: String(data.get('password') ?? ''),
              ...(register ? { name: String(data.get('name') ?? '') } : {}),
            };
            try {
              if (register) {
                await registerAccount(input);
                navigate('/login', { replace: true, state: { registered: true } });
              } else {
                await signIn(input);
              }
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              pending.current = false;
              setBusy(false);
            }
          }}
        >
          <h2>{register ? 'Create your account' : 'Welcome back'}</h2>
          {!register && location.state?.registered && (
            <p role="status" style={{ color: 'var(--color-success)', fontSize: 'var(--text-sm)' }}>
              ✓ Account created successfully. Please sign in.
            </p>
          )}
          {register && (
            <label>
              Name
              <input disabled={busy} name="name" required maxLength={80} autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input
              disabled={busy}
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              disabled={busy}
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete={register ? 'new-password' : 'current-password'}
            />
          </label>
          {register && (
            <small style={{ color: 'var(--color-text-muted)' }}>
              At least 8 characters; at most 72 UTF-8 bytes.
            </small>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy && <span className="spinner spinner-sm" aria-hidden="true" />}
            {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
          </button>
          <Link to={register ? '/login' : '/register'}>
            {register ? 'Already registered? Sign in' : 'Create an account'}
          </Link>
        </form>
      </div>
    </main>
  );
}
