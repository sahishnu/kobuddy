import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { LoginModal } from '@/components/LoginModal';

type AuthUiContextValue = {
  openLoginModal: () => void;
};

const AuthUiContext = createContext<AuthUiContextValue | null>(null);

export function useAuthUi(): AuthUiContextValue {
  const ctx = useContext(AuthUiContext);
  if (!ctx) {
    throw new Error('useAuthUi must be used within AuthUiProvider');
  }
  return ctx;
}

export function AuthUiProvider({ children }: { children: ReactNode }) {
  const [loginOpen, setLoginOpen] = useState(false);
  const openLoginModal = useCallback(() => setLoginOpen(true), []);

  const value = useMemo(
    () => ({
      openLoginModal,
    }),
    [openLoginModal],
  );

  return (
    <AuthUiContext.Provider value={value}>
      {children}
      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </AuthUiContext.Provider>
  );
}
