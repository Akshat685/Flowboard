import { AuthProvider } from '@/features/auth/hooks/AuthContext';
import { ThemeProvider } from '@/hooks/useTheme';
// BoardProvider is scoped to the signed-in user in ProtectedRoute so sign-out clears board state.
export function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
