import { useNavigate } from '@tanstack/react-router';
import { useLayoutEffect } from 'react';
import { useAuthUi } from '@/auth-ui';

/**
 * Preserves old /login links: opens the login modal and sends the user home.
 */
export function LoginRedirectPage() {
  const { openLoginModal } = useAuthUi();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    openLoginModal();
    void navigate({ to: '/', replace: true });
  }, [openLoginModal, navigate]);

  return null;
}
