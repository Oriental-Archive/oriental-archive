import { forwardRef } from "react";
import { cn } from "@/lib/cn";

// Every text input, select, and textarea in the app shares this look and
// these interactive states — previously each of the ~15 admin forms
// hand-rolled its own (and often slightly different: px-2 vs px-3, no
// focus ring anywhere). `Field` on top of these covers the
// label+control(+hint) block that was copy-pasted in every one of them.
const controlBase = cn(
  "rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground",
  "placeholder:text-muted disabled:opacity-50",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
);

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={cn(controlBase, className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref
) {
  return <select ref={ref} className={cn(controlBase, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(controlBase, className)} {...props} />;
  }
);

export function Field(props: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1 text-xs text-muted", props.className)}>
      <span>
        {props.label}
        {props.required && (
          <span aria-hidden className="ml-0.5 text-danger">
            *
          </span>
        )}
      </span>
      {props.children}
      {props.error ? (
        <span role="alert" className="text-[11px] font-medium text-danger">
          {props.error}
        </span>
      ) : (
        props.hint && <span className="text-[11px] text-muted">{props.hint}</span>
      )}
    </label>
  );
}
