import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { RootLayout } from '@/components/RootLayout';
import { AdminBooksPage } from './pages/AdminBooksPage';
import { BooksPage } from './pages/BooksPage';
import { HomePage } from './pages/HomePage';
import { LoginRedirectPage } from './pages/LoginRedirectPage';

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginRedirectPage,
});

const booksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/books',
  component: BooksPage,
});

const adminBooksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/books',
  component: AdminBooksPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  booksRoute,
  adminBooksRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
