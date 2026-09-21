import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthPage } from '@/pages/AuthPage';
import { BoardsPage } from '@/pages/BoardsPage';
import { BoardPage } from '@/pages/BoardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProtectedRoute } from './ProtectedRoute';
export function AppRoutes() {
  return (
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
  );
}
