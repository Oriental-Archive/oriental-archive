import type { Annotation, HighlightColor } from "@/pdf-reader/types";
import { toViewPoint, toViewRect, canonicalBottomSide, type Side } from "@/pdf-reader/lib/rotation";

export const HIGHLIGHT_COLOR_VARS: Record<HighlightColor, string> = {
  yellow: "var(--highlight-yellow)",
  green: "var(--highlight-green)",
  blue: "var(--highlight-blue)",
  red: "var(--highlight-red)",
  purple: "var(--highlight-purple)",
};

// Pure overlay: absolutely-positioned rects only, no canvas/text-layer work,
// so adding/editing/filtering annotations never touches PdfPage's rendering.
export function AnnotationLayer({
  annotations,
  rotation,
  flipVertical,
  onSelect,
}: {
  annotations: Annotation[];
  rotation: 0 | 90 | 180 | 270;
  flipVertical: boolean;
  onSelect: (annotation: Annotation) => void;
}) {
  // pointer-events-none on the wrapper is load-bearing: this div covers the
  // entire page on top of the text layer, and without it — even with zero
  // annotations — it silently eats every mousedown, so no text selection
  // (and therefore no highlight/underline/strikethrough) can ever start.
  // Each mark below re-enables pointer-events on itself explicitly.
  return (
    <div className="pointer-events-none absolute inset-0">
      {annotations.map((a) => (
        <AnnotationMarks key={a.id} annotation={a} rotation={rotation} flipVertical={flipVertical} onSelect={onSelect} />
      ))}
    </div>
  );
}

function AnnotationMarks({
  annotation,
  rotation,
  flipVertical,
  onSelect,
}: {
  annotation: Annotation;
  rotation: 0 | 90 | 180 | 270;
  flipVertical: boolean;
  onSelect: (a: Annotation) => void;
}) {
  const color = HIGHLIGHT_COLOR_VARS[annotation.color];

  if (annotation.type === "drawing" && annotation.points) {
    const points = annotation.points
      .map((p) => toViewPoint(p, rotation, flipVertical))
      .map((p) => `${p.x * 100},${p.y * 100}`)
      .join(" ");
    return (
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Only the ink itself is tappable (with a finger-sized margin) — the svg covers the whole page, so a page-wide hit box would swallow every tap and page turn. */}
        <polyline
          data-annotation-mark=""
          points={points}
          fill="none"
          stroke="transparent"
          strokeWidth={16}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="stroke"
          className="cursor-pointer"
          onClick={() => onSelect(annotation)}
        />
      </svg>
    );
  }

  if (annotation.type === "note") {
    const raw = annotation.rects[0];
    if (!raw) return null;
    const anchor = toViewRect(raw, rotation, flipVertical);
    return (
      <button
        type="button"
        data-annotation-mark=""
        onClick={() => onSelect(annotation)}
        aria-label={`Note: ${annotation.comment.slice(0, 40) || "empty note"}`}
        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full rounded-full border border-border-strong shadow-sm transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-accent"
        style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%`, width: 18, height: 18, background: color }}
      />
    );
  }

  return (
    <>
      {annotation.rects.map((r) => toViewRect(r, rotation, flipVertical)).map((r, i) => (
        <button
          key={i}
          type="button"
          data-annotation-mark=""
          onClick={() => onSelect(annotation)}
          aria-label={`${annotation.type} on "${(annotation.selectedText ?? "").slice(0, 60)}"`}
          className="pointer-events-auto absolute cursor-pointer rounded-[1px]"
          style={{
            left: `${r.x * 100}%`,
            top: `${r.y * 100}%`,
            width: `${r.w * 100}%`,
            height: `${r.h * 100}%`,
            ...markStyle(annotation.type, color, rotation, flipVertical),
          }}
        />
      ))}
    </>
  );
}

const BORDER_PROP: Record<Side, "borderTop" | "borderRight" | "borderBottom" | "borderLeft"> = {
  top: "borderTop",
  right: "borderRight",
  bottom: "borderBottom",
  left: "borderLeft",
};

// Where an underline/strikethrough's line moves off its default (canonical
// bottom, translateY(-45%) toward the strikethrough midline) once rotation
// or a flip has moved that edge to a different side of the box: horizontal
// borders (top/bottom) still slide along Y, vertical ones (left/right,
// after a 90°/270° rotation) slide along X instead, and the sign flips
// whenever the edge itself flipped to the opposite side.
const STRIKETHROUGH_OFFSET: Record<Side, string> = {
  bottom: "translateY(-45%)",
  top: "translateY(45%)",
  left: "translateX(45%)",
  right: "translateX(-45%)",
};

function markStyle(
  type: Annotation["type"],
  color: string,
  rotation: 0 | 90 | 180 | 270,
  flipVertical: boolean
): React.CSSProperties {
  switch (type) {
    case "highlight":
      return { background: color, opacity: 0.38, mixBlendMode: "multiply" };
    case "underline": {
      const side = canonicalBottomSide(rotation, flipVertical);
      return { [BORDER_PROP[side]]: `2px solid ${color}`, background: "transparent" };
    }
    case "strikethrough": {
      const side = canonicalBottomSide(rotation, flipVertical);
      return {
        background: "transparent",
        [BORDER_PROP[side]]: `2px solid ${color}`,
        transform: STRIKETHROUGH_OFFSET[side],
      };
    }
    case "area":
      return { border: `1.5px dashed ${color}`, background: "transparent" };
    default:
      return {};
  }
}
