import { useQuery } from '@tanstack/react-query';
import { fetchAdminBooks, fetchBooks, fetchHomeShelfBooks } from '@/api';

export function useBooksList() {
  return useQuery({
    queryKey: ['books', 'all'],
    queryFn: () => fetchBooks(),
  });
}

export function useHomeShelfBooks() {
  return useQuery({
    queryKey: ['books', 'shelf'],
    queryFn: fetchHomeShelfBooks,
  });
}

export function useAdminBooksList(enabled: boolean) {
  return useQuery({
    queryKey: ['books', 'admin', 'lastOpen', 'showHidden'],
    queryFn: fetchAdminBooks,
    enabled,
  });
}
