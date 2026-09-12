"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

// Deliberately talks to the better-auth HTTP endpoints directly with plain
// fetch rather than pulling in the better-auth client SDK — this is the one
// page that needs it, and the endpoints are already exercised by curl in
// earlier phases, so there's nothing the client SDK would buy here.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Generic message regardless of which part was wrong (spec §29).
        setError(data.message || "Invalid email or password.");
        return;
      }
      if (data.twoFactorRedirect) {
        setNeedsTwoFactor(true);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      // A network drop or a non-JSON error response (res.json() throwing)
      // previously left this silently doing nothing — busy reset by the
      // finally below, but no sign anything went wrong.
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTwoFactorSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/two-factor/verify-totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        setError("Invalid code.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid flex-1 sm:grid-cols-2">
      <div className="flex flex-col justify-center bg-navy px-8 py-12 sm:px-14 sm:py-16">
        <p className="font-serif text-2xl text-background">Oriental Archive</p>
        <p className="mt-4 max-w-xs font-serif text-base text-background/70 italic">
          A reading room for Oriental Orthodox manuscripts, homilies, and
          hagiography — open to librarians and registered readers.
        </p>
      </div>

      <div className="flex flex-col justify-center px-8 py-12 sm:px-14 sm:py-16">
        <div className="max-w-sm">
          <h1 className="border-b border-border pb-4 font-serif text-2xl text-foreground">
            {needsTwoFactor ? "Enter your authentication code" : "Sign in"}
          </h1>

          {!needsTwoFactor ? (
            <form onSubmit={handlePasswordSubmit} className="mt-6 flex flex-col gap-4">
              <Field label="Email">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={busy} className="self-start">
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleTwoFactorSubmit} className="mt-6 flex flex-col gap-4">
              <Field label="6-digit code">
                <Input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={busy} className="self-start">
                {busy ? "Verifying…" : "Verify"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
