"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Dict } from "@/lib/i18n";

type AdminDict = Dict["admin"];

export function LoginForm({ t }: { t: AdminDict }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(false);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        setError(true);
        setBusy(false);
        return;
      }

      window.location.reload();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        id="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={t.email}
        aria-label={t.email}
        autoComplete="username"
        className="field"
      />

      <input
        id="password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder={t.password}
        aria-label={t.password}
        autoComplete="current-password"
        className="field"
      />

      {error ? (
        <p role="alert" className="px-1 text-[0.9375rem] font-medium text-coral">
          {t.signInError}
        </p>
      ) : null}

      <Button type="submit" tone="lime" size="lg" disabled={busy} className="mt-1">
        {t.signIn}
      </Button>
    </form>
  );
}
