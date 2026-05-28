import { useQuery } from '@tanstack/react-query';
import {
  type AdminBooksPageParams,
  type BooksPageParams,
  fetchAdminBooksPage,
  fetchBooksPage,
  fetchHomeShelfBooks,
} from '@/api';

export const BOOKS_LIST_PAGE_SIZE = 25;

export function useBooksPage(params: BooksPageParams) {
  return useQuery({
    queryKey: [
      'books',
      'library',
      'page',
      params.page,
      params.pageSize ?? BOOKS_LIST_PAGE_SIZE,
      params.q ?? '',
      params.sort ?? '',
    ],
    queryFn: () =>
      fetchBooksPage({
        ...params,
        pageSize: params.pageSize ?? BOOKS_LIST_PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });
}

export function useHomeShelfBooks() {
  return useQuery({
    queryKey: ['books', 'shelf'],
    queryFn: fetchHomeShelfBooks,
  });
}

export function useAdminBooksPage(
  enabled: boolean,
  params: AdminBooksPageParams,
) {
  return useQuery({
    queryKey: [
      'books',
      'admin',
      'page',
      params.page,
      params.pageSize ?? BOOKS_LIST_PAGE_SIZE,
      params.q ?? '',
      params.hiddenOnly ?? false,
    ],
    queryFn: () =>
      fetchAdminBooksPage({
        ...params,
        pageSize: params.pageSize ?? BOOKS_LIST_PAGE_SIZE,
      }),
    enabled,
    placeholderData: (prev) => prev,
  });
}
