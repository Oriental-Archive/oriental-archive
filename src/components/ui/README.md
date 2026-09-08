# Design system

Every interactive element and surface in the app is built from what's here —
no page or component should hand-roll its own button/input/card Tailwind
classes. If you need something that doesn't exist yet, extend a primitive
below rather than writing a one-off class string next to your JSX.

## Colors

Defined once, in `src/app/globals.css` (`:root` + `@theme inline`). Never use
a raw Tailwind color (`bg-white`, `text-gray-500`, `bg-red-600`, `bg-[#...]`)
anywhere — add a token in `globals.css` first if the palette is missing
something.

| Token | Use |
|---|---|
| `background` | page background |
| `surface` | cards, panels, inputs, the reader's "paper" |
| `foreground` / `muted` | body text / secondary text |
| `border` | hairlines, card/input borders |
| `navy` / `primary` | brand accent, primary buttons |
| `burgundy` / `danger` | hover accent, destructive buttons, error text |
| `gold` / `focus-ring` | restrained highlight, tags, focus rings |

`primary`/`danger`/`focus-ring` are semantic aliases over the brand colors,
not new hues — this app's palette is deliberately small (see the comment in
`globals.css`), so "danger" reuses burgundy rather than introducing a stock
UI red.

## Components

- **`Button` / `buttonVariants`** — every clickable action. `variant`:
  `primary` (default) · `secondary` (outlined) · `destructive` (filled
  burgundy) · `ghost` (bare text — nav links, "← Back") · `toolbar` (the
  reader's dark chrome only). `size`: `sm` · `md` (default) · `icon` ·
  `inline` (default for `ghost`) · `xs` (default for `toolbar`). Use
  `buttonVariants({...})` to style a `<Link>` or `<a>` identically to a
  `Button` — never render a real `<button>` where the element needs to stay
  a link (file downloads, external URLs).
- **`Field` / `Input` / `Select` / `Textarea`** — every form control.
  `<Field label="…"><Input /></Field>` replaces the old
  `<label className="...">text<input className="..." /></label>` copy-paste.
- **`Card`** — the surface panel. `as="div"` (default) · `"li"` (inside a
  `<ul>`) · `"form"`. `padding`: `none` · `sm` · `md` · `lg` (default).
  Always use the `padding` prop, never a `p-*` class in `className` — see
  the comment in `Card.tsx` for why (this codebase's `cn()` has no
  Tailwind-conflict resolution).
- **`Badge`** — small chips: `outline` (neutral tags), `gold` (topic tags),
  `solid` (active state), `featured`.
- **`StatusTabs`** — the filter-pill row used by every librarian list page.
- **`Dialog`** — a real modal (native `<dialog>`, focus-trapped,
  Escape-to-close). Reach for this directly only when the trigger isn't a
  plain button (see `AccountManageForm`'s disable-account checkbox);
  otherwise use `ConfirmButton`.
- **`ConfirmButton`** — **the only way a destructive or sensitive action
  should be wired up.** Renders a trigger button that opens a `Dialog`
  before calling `onConfirm`. If you're adding a delete/remove/disable/
  revoke action, reach for this first — it's less code than hand-rolling
  the fetch-on-click it replaces.

## Rules of thumb

- A className string is joined with `cn()` (`lib/cn.ts`), a plain
  `.filter(Boolean).join(" ")` — there's no conflict resolution. Never pass
  two utilities for the same CSS property (e.g. two padding classes) into
  one component; use the component's props (`size`, `padding`, `variant`)
  instead.
- Every interactive primitive already has a `focus-visible` ring baked in —
  don't add your own unless you're styling a genuinely bespoke control that
  doesn't go through one of these (and even then, use `ring-focus-ring`).
