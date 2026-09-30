import { useAuth } from '@/features/auth/hooks/AuthContext';
import { DocumentHead } from '@/components/common/DocumentHead';
import { PageLoader } from '@/components/common/PageLoader';
import { AppRoutes } from '@/routes';
export default function App() {
  const { loading, error, restore } = useAuth();
  return (
    <>
      <DocumentHead />
      {loading ? (
        <PageLoader />
      ) : error ? (
        <PageLoader
          title="Can't reach Flowboard"
          message={error}
          action={
            <button className="btn btn-primary" onClick={restore}>
              Retry connection
            </button>
          }
        />
      ) : (
        <AppRoutes />
      )}
    </>
  );
}
