export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; icon: React.ReactNode }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="flex border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex flex-1 flex-col items-center gap-1 border-b-2 px-2 py-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
            active === tab.id
              ? "border-accent text-accent"
              : "border-transparent text-text-muted hover:text-text-secondary"
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
