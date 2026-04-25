type PageErrorProps = {
  error: Error;
};

export function PageError({ error }: PageErrorProps) {
  return (
    <div className="space-y-3 p-6">
      <p className="text-sm text-destructive">{error.message}</p>
    </div>
  );
}
