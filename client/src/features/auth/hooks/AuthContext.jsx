import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { authApi } from '../auth.api';
import { errorMessage, errorStatus } from '@/utils/errors';
import { advanceSession } from '@/services/http';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const restoring = useRef(null);
  function invalidate() {
    restoring.current?.abort();
    advanceSession();
    return ++sequence.current;
  }
  async function restore() {
    const seq = invalidate();
    const controller = new AbortController();
    restoring.current = controller;
    setLoading(true);
    setError('');
    try {
      const data = await authApi.me({ signal: controller.signal });
      if (seq === sequence.current) setUser(data.user);
    } catch (err) {
      if (seq !== sequence.current || err.name === 'AbortError') return;
      setUser(null);
      if (errorStatus(err) !== 401) setError(errorMessage(err));
    } finally {
      if (seq === sequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    void restore();
    const expired = () => {
      invalidate();
      setUser(null);
      setLoading(false);
      setError('');
    };
    window.addEventListener('flowboard:unauthorized', expired);
    return () => {
      invalidate();
      window.removeEventListener('flowboard:unauthorized', expired);
    };
  }, []);
  const registerAccount = (input) => authApi.register(input);
  const signIn = async (input) => {
    const seq = invalidate();
    const data = await authApi.login(input);
    if (seq === sequence.current) {
      advanceSession();
      setUser(data.user);
      setLoading(false);
      setError('');
    }
  };
  const signOut = async () => {
    invalidate();
    try {
      await authApi.logout();
    } catch (err) {
      if (errorStatus(err) !== 401) throw err;
    }
    setUser(null);
    setLoading(false);
  };
  return (
    <AuthContext.Provider
      value={{ user, loading, error, restore, registerAccount, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
