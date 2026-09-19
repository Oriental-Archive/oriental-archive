import { Modal } from "@/pdf-reader/components/common/Modal";
import type { AppSettings } from "@/pdf-reader/hooks/useAppSettings";
import type { HighlightColor, PageAnimation, PdfAppearance, ReadingMode, SpreadMode, ThemePreference, ZoomMode } from "@/pdf-reader/types";
import { HIGHLIGHT_COLOR_VARS } from "@/pdf-reader/components/pdf/AnnotationLayer";

const COLORS: HighlightColor[] = ["yellow", "green", "blue", "red", "purple"];

export function ReaderSettingsDialog({
  settings,
  onChange,
  onClose,
  onOpenShortcuts,
  showAnnotations,
  onToggleShowAnnotations,
  onApplyZoomMode,
  touch,
}: {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
  onClose: () => void;
  onOpenShortcuts: () => void;
  /** Live per-session visibility (same state the command palette and focus-mode bar control) — not a persisted default, so it takes effect immediately. */
  showAnnotations: boolean;
  onToggleShowAnnotations: () => void;
  /** Page display is both a default for new documents and an instant change to the one you're reading. */
  onApplyZoomMode: (mode: ZoomMode) => void;
  touch: boolean;
}) {
  return (
    <Modal title="Reader settings" onClose={onClose} width={420}>
      <div className="space-y-5">
        <Field label="Reading mode">
          <Segmented<ReadingMode>
            value={settings.readingMode}
            onChange={(v) => onChange({ readingMode: v })}
            options={[
              { value: "scroll", label: "Continuous scroll" },
              { value: "pageTurn", label: "Page turn" },
            ]}
          />
        </Field>

        {settings.readingMode === "pageTurn" && (
          <Field label="Two-page spread" hint="Auto shows facing pages on wide, landscape screens.">
            <Segmented<SpreadMode>
              value={settings.spread}
              onChange={(v) => onChange({ spread: v })}
              options={[
                { value: "auto", label: "Auto" },
                { value: "off", label: "Off" },
                { value: "on", label: "On" },
              ]}
            />
          </Field>
        )}

        <Field label="Page display">
          <Segmented<ZoomMode>
            value={settings.defaultZoomMode}
            onChange={(v) => {
              onChange({ defaultZoomMode: v });
              onApplyZoomMode(v);
            }}
            options={[
              { value: "fit-width", label: "Fit width" },
              { value: "fit-page", label: "Fit page" },
              { value: "actual-size", label: "100%" },
            ]}
          />
        </Field>

        <Field label="Theme">
          <Segmented<ThemePreference>
            value={settings.theme}
            onChange={(v) => onChange({ theme: v })}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ]}
          />
        </Field>

        {settings.readingMode === "pageTurn" && (
          <>
            <Field label="Page-turn animation" hint="Reduced uses a quick fade; it's also used automatically when your device asks for reduced motion.">
              <Segmented<PageAnimation>
                value={settings.pageAnimation}
                onChange={(v) => onChange({ pageAnimation: v })}
                options={[
                  { value: "on", label: "On" },
                  { value: "reduced", label: "Reduced" },
                  { value: "off", label: "Off" },
                ]}
              />
            </Field>
            <Toggle label="Tap screen edges to turn pages" checked={settings.edgeTaps} onChange={(v) => onChange({ edgeTaps: v })} />
          </>
        )}

        <Field label="Highlight color" hint="Remembers the last one you used.">
          <div className="flex items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={settings.defaultHighlightColor === c}
                onClick={() => onChange({ defaultHighlightColor: c })}
                className="flex h-9 w-9 items-center justify-center"
              >
                <span
                  className="block h-5 w-5 rounded-full"
                  style={{
                    background: HIGHLIGHT_COLOR_VARS[c],
                    outline: settings.defaultHighlightColor === c ? "2px solid var(--text-primary)" : "1px solid var(--border-strong)",
                    outlineOffset: 2,
                  }}
                />
              </button>
            ))}
          </div>
        </Field>

        <Field label="PDF page appearance">
          <select
            value={settings.pdfAppearance}
            onChange={(e) => onChange({ pdfAppearance: e.target.value as PdfAppearance })}
            className="min-h-10 w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-[13px]"
          >
            <option value="original">Original</option>
            <option value="dimmed">Dimmed</option>
            <option value="inverted">Inverted (experimental)</option>
          </select>
          <p className="mt-1 text-[11px] text-text-muted">
            Original preserves scanned manuscripts exactly as archived. Inverted can reduce legibility on scans —
            use with care.
          </p>
        </Field>

        <div className="space-y-1">
          <Toggle
            label="Remember last reading position"
            checked={settings.rememberLastPosition}
            onChange={(v) => onChange({ rememberLastPosition: v })}
          />
          <Toggle label="Show annotation indicators" checked={showAnnotations} onChange={onToggleShowAnnotations} />
          <Toggle label="Smooth scrolling" checked={settings.smoothScrolling} onChange={(v) => onChange({ smoothScrolling: v })} />
        </div>

        {!touch && (
          <button type="button" onClick={onOpenShortcuts} className="text-xs font-medium text-accent">
            View keyboard shortcuts →
          </button>
        )}
      </div>
    </Modal>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-text-muted">{hint}</p>}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" className="flex overflow-hidden rounded-lg border border-border">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 flex-1 px-2 text-[13px] transition-colors [@media(pointer:coarse)]:min-h-11 ${i > 0 ? "border-l border-border" : ""} ${
            value === o.value ? "bg-accent-subtle font-medium text-accent" : "text-text-secondary active:bg-surface-hover"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between"
    >
      <span className="text-[13.5px] text-text-secondary">{label}</span>
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-border-strong"}`}>
        <span
          className={`absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[1.125rem]" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}
