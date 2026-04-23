import { Toaster } from 'sonner';
import { useTheme } from '@/theme/theme-provider';

export function AppToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="bottom-center"
      richColors
      closeButton
      toastOptions={{ duration: 5200 }}
    />
  );
}
