export function FullPageStatus({ label }: { label: string }) {
  return (
    <main className="full-page-status" role="status">
      <span className="loading-spinner" />
      <span>{label}</span>
    </main>
  );
}
