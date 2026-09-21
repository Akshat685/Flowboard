import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/AuthContext';
import { BoardProvider } from '@/features/boards/hooks/BoardContext';
import { Shell } from '@/components/layout/Shell';
export function ProtectedRoute() {
  const { user } = useAuth();
  return user ? (
    <BoardProvider key={user._id}>
      <Shell />
    </BoardProvider>
  ) : (
    <Navigate to="/login" replace />
  );
}
