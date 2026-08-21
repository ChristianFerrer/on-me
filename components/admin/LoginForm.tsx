"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EyeIcon, EyeOffIcon } from "@/components/ui/Icons";
import type { Dict } from "@/lib/i18n";

type AdminDict = Dict["admin"];

export function LoginForm({ t }: { t: AdminDict }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<"credentials" | "rate" | "no_access" | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleForgotSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    try {
      await fetch("/api/admin/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      // Siempre "enviado", exista o no la cuenta: no hay nada más que decir
      // sin filtrar qué emails tienen acceso al panel de algún local.
      setForgotSent(true);
      setBusy(false);
    }
  }

  if (forgotMode) {
    return (
      <form onSubmit={handleForgotSubmit} className="flex flex-col gap-3">
        {forgotSent ? (
          <p role="status" className="px-1 text-[0.9375rem] leading-relaxed text-chalk/70">
            {t.forgotPasswordSent}
          </p>
        ) : (
          <>
            <p className="px-1 text-[0.8125rem] leading-relaxed text-chalk/55">
              {t.forgotPasswordBody}
            </p>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t.email}
              aria-label={t.email}
              autoComplete="username"
              className="field"
            />
            <Button type="submit" tone="lime" size="lg" disabled={busy} className="mt-1">
              {t.forgotPasswordSubmit}
            </Button>
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setForgotMode(false);
            setForgotSent(false);
          }}
          className="px-1 text-center text-[0.8125rem] font-medium text-chalk/55 transition-colors hover:text-chalk"
        >
          {t.forgotPasswordBack}
        </button>
      </form>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        const code = (data as { error?: string } | null)?.error;
        setError(code === "rate" || code === "no_access" ? code : "credentials");
        setBusy(false);
        return;
      }

      window.location.reload();
    } catch {
      setError("credentials");
      setBusy(false);
    }
  }

  const errorMessage =
    error === "rate"
      ? t.signInErrorRate
      : error === "no_access"
        ? t.signInErrorNoAccess
        : t.signInError;

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

      <div className="relative">
        <input
          id="password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t.password}
          aria-label={t.password}
          autoComplete="current-password"
          className="field pr-14"
        />
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          aria-label={showPassword ? t.hidePassword : t.showPassword}
          aria-pressed={showPassword}
          className="absolute inset-y-0 right-1.5 flex items-center px-3 text-chalk/45 transition-colors hover:text-chalk"
        >
          {showPassword ? (
            <EyeOffIcon className="size-5" />
          ) : (
            <EyeIcon className="size-5" />
          )}
        </button>
      </div>

      {error ? (
        <p role="alert" className="px-1 text-[0.9375rem] font-medium text-coral">
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" tone="lime" size="lg" disabled={busy} className="mt-1">
        {t.signIn}
      </Button>

      <button
        type="button"
        onClick={() => setForgotMode(true)}
        className="px-1 text-center text-[0.8125rem] font-medium text-chalk/55 transition-colors hover:text-chalk"
      >
        {t.forgotPassword}
      </button>
    </form>
  );
}
