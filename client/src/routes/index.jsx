import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageLoader } from '@/components/common/PageLoader';
import { ProtectedRoute } from './ProtectedRoute';

const AuthPage = lazy(() => import('@/pages/AuthPage'));
const BoardsPage = lazy(() => import('@/pages/BoardsPage'));
const BoardPage = lazy(() => import('@/pages/BoardPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function SuspenseFallback() {
  return <PageLoader message="Loading your workspace…" />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <Routes>
        <Route path="/login" element={<AuthPage key="login" mode="login" />} />
        <Route path="/register" element={<AuthPage key="register" mode="register" />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/boards" element={<BoardsPage />} />
          <Route path="/boards/:boardId" element={<BoardPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/boards" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
