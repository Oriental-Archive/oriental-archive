"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";

type FieldKey = "name" | "email" | "username" | "password";

export function CreateAccountForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [busy, setBusy] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const fieldRefs: Partial<Record<FieldKey, React.RefObject<HTMLInputElement | null>>> = {
    name: nameRef,
    email: emailRef,
    username: usernameRef,
    password: passwordRef,
  };

  function flagField(key: FieldKey, message: string) {
    setFieldErrors({ [key]: message });
    setError(null);
    const el = fieldRefs[key]?.current;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus();
  }

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        const entries = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
        if (entries.name.trim() === "") return flagField("name", "Name is required — fill in this box before saving.");
        if (entries.email.trim() === "") return flagField("email", "Email is required — fill in this box before saving.");
        if (entries.password.trim() === "")
          return flagField("password", "Password is required — fill in this box before saving.");
        if (entries.password.length < 12) return flagField("password", "Password must be at least 12 characters.");

        // Optional fields (username) must be omitted rather than sent as ""
        // — the API's schema allows them to be absent, not empty.
        const data = Object.fromEntries(
          Object.entries(entries).filter(([, v]) => typeof v === "string" && v.trim() !== "")
        );
        setBusy(true);
        try {
          const res = await fetch("/api/admin/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (!res.ok) {
            const body = await res.json();
            const issue = body.issues?.[0];
            const key = issue?.path?.[0] as FieldKey | undefined;
            if (key && key in fieldRefs) {
              flagField(key, issue.message);
            } else {
              setError(issue?.message ?? body.error ?? "Failed to create account.");
            }
            return;
          }
          router.push("/librarian/accounts");
          router.refresh();
        } catch {
          // A network drop or a non-JSON error response previously left
          // this silently doing nothing — busy reset by the finally below,
          // but no sign anything went wrong.
          setError("Couldn't reach the server — check your connection and try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Name" required error={fieldErrors.name}>
        <Input ref={nameRef} name="name" />
      </Field>
      <Field label="Email" required error={fieldErrors.email}>
        <Input ref={emailRef} name="email" type="email" />
      </Field>
      <Field label="Username" hint="Optional." error={fieldErrors.username}>
        <Input ref={usernameRef} name="username" />
      </Field>
      <Field label="Account Type">
        <Select name="role" defaultValue="STANDARD">
          <option value="STANDARD">Standard Account</option>
          <option value="LIBRARIAN">Librarian</option>
        </Select>
      </Field>
      <Field label="Initial Password" required error={fieldErrors.password} hint="12+ characters.">
        <Input ref={passwordRef} name="password" type="password" />
      </Field>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" disabled={busy} size="md" className="self-start">
        {busy ? "Creating…" : "Create Account"}
      </Button>
    </form>
  );
}
