import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const titles = {
  '/': 'Flowboard — Organize your work',
  '/login': 'Sign in — Flowboard',
  '/register': 'Create account — Flowboard',
  '/boards': 'Your boards — Flowboard',
};

export function DocumentHead() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = pathname.startsWith('/boards/')
      ? 'Board — Flowboard'
      : (titles[pathname] ?? 'Flowboard — Organize your work');
  }, [pathname]);
  return null;
}
