export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="mb-1 text-text-muted">{icon}</div>
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      <p className="max-w-[220px] text-xs leading-relaxed text-text-muted">{description}</p>
    </div>
  );
}
