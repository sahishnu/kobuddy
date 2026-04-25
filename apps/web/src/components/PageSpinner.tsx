import { Spinner } from '@/components/ui/spinner';

export function PageSpinner() {
  return (
    <div className="flex justify-center p-10">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  );
}
