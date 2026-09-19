import { useState } from "react";
import { RotateCw, RotateCcw, FlipVertical, ChevronDown } from "lucide-react";
import { IconButton } from "@/pdf-reader/components/common/IconButton";

// A dropdown rather than a single button: a lone "Rotate page" icon sat right
// next to Undo/Redo and read as one of them at a glance. Splitting rotation
// into its own menu (CW / CCW / flip) removes the mix-up and makes room for
// flip without a fourth icon crowding the bar.
export function RotateControl({
  flipVertical,
  onRotateCW,
  onRotateCCW,
  onToggleFlipVertical,
}: {
  flipVertical: boolean;
  onRotateCW: () => void;
  onRotateCCW: () => void;
  onToggleFlipVertical: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <IconButton label="Rotate / flip page" active={open || flipVertical} onClick={() => setOpen((o) => !o)}>
        <span className="flex items-center">
          <RotateCw size={15} />
          <ChevronDown size={10} />
        </span>
      </IconButton>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 z-40 mt-1 w-48 rounded-lg border border-border bg-surface-elevated py-1 shadow-md">
            <button
              type="button"
              onClick={() => {
                onRotateCW();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-surface-hover"
            >
              <RotateCw size={14} />
              Rotate clockwise
            </button>
            <button
              type="button"
              onClick={() => {
                onRotateCCW();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-surface-hover"
            >
              <RotateCcw size={14} />
              Rotate counter-clockwise
            </button>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={() => {
                onToggleFlipVertical();
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-hover ${
                flipVertical ? "font-medium text-accent" : "text-text-secondary"
              }`}
            >
              <FlipVertical size={14} />
              Flip vertical
            </button>
          </div>
        </>
      )}
    </div>
  );
}
