export function Spinner({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <span
      className={`animate-spin rounded-full border-2 border-brand-500 border-t-transparent ${className}`}
      role="status"
      aria-label="Chargement"
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  );
}
