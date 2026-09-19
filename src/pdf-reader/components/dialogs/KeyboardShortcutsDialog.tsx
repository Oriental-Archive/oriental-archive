import { Modal } from "@/pdf-reader/components/common/Modal";
import { SHORTCUTS, shortcutKeyLabel } from "@/pdf-reader/lib/shortcuts";

export function KeyboardShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} width={420}>
      <div className="space-y-1">
        {SHORTCUTS.map((s) => (
          <div key={s.id} className="flex items-center justify-between py-1 text-[13px]">
            <span className="text-text-secondary">{s.label}</span>
            <kbd className="rounded-md border border-border bg-background-secondary px-1.5 py-0.5 font-mono text-[11px] text-text-primary">
              {shortcutKeyLabel(s.keys)}
            </kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
}
