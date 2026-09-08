"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        // better-auth requires a JSON content type and a parseable (even if
        // empty) body on every POST, sign-out included.
        await fetch("/api/auth/sign-out", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
