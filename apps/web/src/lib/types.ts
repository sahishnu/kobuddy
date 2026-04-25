export type BookListRow = {
  md5: string;
  displayTitle: string;
  coverUrl: string | null;
  authors: string | null;
  lastOpen: number | null;
  title: string | null;
  customTitle: string | null;
  isbn: string | null;
  hidden: boolean;
  completed: boolean;
  completedAt: number | null;
  coverSource: string | null;
  totalReadTime: number;
  totalReadPages: number;
  pages: number;
  percentComplete: number;
};
