import { cloneElement, useId, useState } from "react";
import { shortcutKeyLabel } from "@/pdf-reader/lib/shortcuts";

export function Tooltip({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut?: string;
  children: React.ReactElement<{ "aria-describedby"?: string }>;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {cloneElement(children, { "aria-describedby": visible ? id : undefined })}
      {visible && (
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none absolute top-full left-1/2 z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-text-primary px-2 py-1 text-[11px] font-medium text-background shadow-sm"
        >
          {label}
          {shortcut && <span className="ml-1.5 opacity-60">{shortcutKeyLabel(shortcut)}</span>}
        </span>
      )}
    </span>
  );
}
