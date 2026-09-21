import { useAuth } from '@/features/auth/hooks/AuthContext';
import { AppRoutes } from '@/routes';
export default function App() {
  const { loading, error, restore } = useAuth();
  if (loading)
    return (
      <main className="page" role="status">
        Restoring your session…
      </main>
    );
  if (error)
    return (
      <main className="page">
        <p role="alert">{error}</p>
        <button onClick={restore}>Retry connection</button>
      </main>
    );
  return <AppRoutes />;
}
