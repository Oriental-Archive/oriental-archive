import { useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import type { ZoomMode } from "@/pdf-reader/types";
import { IconButton } from "@/pdf-reader/components/common/IconButton";

const MODE_LABEL: Record<ZoomMode, string> = {
  "fit-width": "Fit width",
  "fit-page": "Fit page",
  "actual-size": "Actual size",
  custom: "Custom",
};

export function ZoomControl({
  zoomMode,
  scale,
  onSetMode,
  onZoomIn,
  onZoomOut,
}: {
  zoomMode: ZoomMode;
  scale: number;
  onSetMode: (mode: ZoomMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-0.5">
      <IconButton label="Zoom out" shortcut="Mod+-" onClick={onZoomOut}>
        <Minus size={15} />
      </IconButton>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-hover"
      >
        {Math.round(scale * 100)}%
        <ChevronDown size={12} />
      </button>
      <IconButton label="Zoom in" shortcut="Mod+=" onClick={onZoomIn}>
        <Plus size={15} />
      </IconButton>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 z-40 mt-1 w-36 rounded-lg border border-border bg-surface-elevated py-1 shadow-md">
            {(Object.keys(MODE_LABEL) as ZoomMode[])
              .filter((m) => m !== "custom")
              .map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    onSetMode(mode);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-surface-hover ${
                    zoomMode === mode ? "font-medium text-accent" : "text-text-secondary"
                  }`}
                >
                  {MODE_LABEL[mode]}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
