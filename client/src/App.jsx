import { useAuth } from '@/features/auth/hooks/AuthContext';
import { PageLoader } from '@/components/common/PageLoader';
import { AppRoutes } from '@/routes';
export default function App() {
  const { loading, error, restore } = useAuth();
  if (loading) return <PageLoader />;
  if (error)
    return (
      <PageLoader
        title="Can't reach Flowboard"
        message={error}
        action={
          <button className="btn btn-primary" onClick={restore}>
            Retry connection
          </button>
        }
      />
    );
  return <AppRoutes />;
}
