import { Check, CloudOff, AlertCircle, Loader2 } from "lucide-react";
import type { SaveStatus } from "@/pdf-reader/types";

const CONFIG: Record<SaveStatus, { label: string; icon: React.ReactNode; className: string } | null> = {
  idle: null,
  saving: { label: "Saving…", icon: <Loader2 size={12} className="animate-spin" />, className: "text-text-muted" },
  saved: { label: "Saved", icon: <Check size={12} />, className: "text-text-muted" },
  offline: { label: "Offline", icon: <CloudOff size={12} />, className: "text-warning" },
  error: { label: "Sync error", icon: <AlertCircle size={12} />, className: "text-danger" },
};

export function ReaderStatus({ status }: { status: SaveStatus }) {
  const config = CONFIG[status];
  if (!config) return null;
  return (
    <span className={`flex items-center gap-1 px-1.5 text-[11px] ${config.className}`} role="status">
      {config.icon}
      {config.label}
    </span>
  );
}
