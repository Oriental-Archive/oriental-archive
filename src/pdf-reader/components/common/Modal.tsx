import { useEffect } from "react";
import { X } from "lucide-react";
import { BottomSheet } from "@/pdf-reader/components/common/BottomSheet";
import { useDeviceProfile } from "@/pdf-reader/hooks/useDeviceProfile";

/**
 * A centered dialog on desktop, a bottom sheet on phones — same API, so every
 * dialog in the reader (settings, citation, annotation editor, info…) gets the
 * touch-native treatment without each one knowing about it.
 */
export function Modal({
  title,
  onClose,
  children,
  width = 420,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  const { form } = useDeviceProfile();
  if (form === "phone") {
    return (
      <BottomSheet title={title} onClose={onClose}>
        <div className="pb-4">{children}</div>
      </BottomSheet>
    );
  }
  return (
    <DesktopModal title={title} onClose={onClose} width={width}>
      {children}
    </DesktopModal>
  );
}

function DesktopModal({
  title,
  onClose,
  children,
  width,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width: number;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[8vh] sm:pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="max-h-[80vh] w-full max-w-[calc(100vw-2rem)] overflow-auto rounded-xl border border-border bg-surface-elevated shadow-lg sm:max-h-[70vh]"
        style={{ maxWidth: `min(${width}px, calc(100vw - 2rem))` }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
