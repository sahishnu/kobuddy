import { useQuery } from '@tanstack/react-query';
import { apiJson } from '@/api';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiJson<{ isAdmin: boolean }>('/api/auth/me'),
  });
}
