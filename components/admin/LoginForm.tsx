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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="overline text-paper/50">
          {t.email}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          className="field mt-2"
        />
      </div>

      <div>
        <label htmlFor="password" className="overline text-paper/50">
          {t.password}
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="field mt-2"
        />
      </div>

      {error ? (
        <p role="alert" className="text-[0.95rem] font-semibold text-tomato">
          {t.signInError}
        </p>
      ) : null}

      <Button type="submit" tone="saffron" size="lg" disabled={busy}>
        {t.signIn}
      </Button>
    </form>
  );
}
