"use client";

import { useEffect, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";
import { EyeIcon, EyeOffIcon } from "@/components/ui/Icons";
import type { Dict } from "@/lib/i18n";

type Status = "checking" | "invalid" | "ready" | "success";

/**
 * Segunda mitad del "olvidé mi contraseña": la persona llega aquí desde el
 * enlace del email de Supabase Auth, que trae la sesión de recuperación
 * incrustada en el propio fragmento de la URL (`#access_token=...`). Solo el
 * navegador puede leer ese fragmento -no llega nunca al servidor-, así que
 * este es el único sitio del panel donde se crea un cliente de Supabase del
 * lado del cliente, con su propia anon key pública -ver la nota en
 * lib/env.ts-. Guardada la contraseña nueva, se cierra esa sesión de
 * Supabase: el panel sigue usando su propia cookie firmada, no la de
 * Supabase, así que hay que volver a entrar por /admin con la contraseña
 * recién puesta.
 */
export function ResetPasswordForm({ t }: { t: Dict }) {
  const [client] = useState<SupabaseClient | null>(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return null;
    return createClient(url, anonKey);
  });
  const [status, setStatus] = useState<Status>(client ? "checking" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;

    let cancelled = false;

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!cancelled && event === "PASSWORD_RECOVERY" && session) setStatus("ready");
    });

    // El cliente ya procesó el fragmento de la URL al crearse -detectSessionInUrl,
    // activo por defecto-; si había una sesión de recuperación válida, ya está
    // disponible aquí mismo, sin depender de que el evento de arriba llegue a
    // tiempo en todos los navegadores.
    void client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setStatus("ready");
      else setStatus((current) => (current === "checking" ? "invalid" : current));
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [client]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !client) return;
    setFormError(null);

    if (password.length < 8) {
      setFormError(t.admin.resetPasswordTooShort);
      return;
    }
    if (password !== confirm) {
      setFormError(t.admin.resetPasswordMismatch);
      return;
    }

    setBusy(true);
    const { error } = await client.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setFormError(t.admin.resetPasswordError);
      return;
    }

    await client.auth.signOut();
    setStatus("success");
  }

  if (status === "checking") {
    return <p className="text-center text-[0.9375rem] text-chalk/55">{t.common.loading}</p>;
  }

  if (status === "invalid") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-[0.9375rem] leading-relaxed text-chalk/70">
          {t.admin.resetPasswordInvalidLink}
        </p>
        <a href="/admin/constelacion-sol" className="text-[0.8125rem] font-medium text-chalk/55 transition-colors hover:text-chalk">
          {t.admin.resetPasswordGoToLogin}
        </a>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-[0.9375rem] leading-relaxed text-chalk/70">
          {t.admin.resetPasswordSuccess}
        </p>
        <a href="/admin/constelacion-sol" className="text-[0.8125rem] font-medium text-lime">
          {t.admin.resetPasswordGoToLogin}
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <div className="relative">
        <input
          id="new-password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t.admin.password}
          aria-label={t.admin.password}
          autoComplete="new-password"
          className="field pr-14"
        />
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          aria-label={showPassword ? t.admin.hidePassword : t.admin.showPassword}
          aria-pressed={showPassword}
          className="absolute inset-y-0 right-1.5 flex items-center px-3 text-chalk/45 transition-colors hover:text-chalk"
        >
          {showPassword ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
        </button>
      </div>

      <input
        id="confirm-password"
        type={showPassword ? "text" : "password"}
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        placeholder={t.admin.resetPasswordConfirmLabel}
        aria-label={t.admin.resetPasswordConfirmLabel}
        autoComplete="new-password"
        className="field"
      />

      {formError ? (
        <p role="alert" className="px-1 text-[0.9375rem] font-medium text-coral">
          {formError}
        </p>
      ) : null}

      <Button type="submit" tone="lime" size="lg" disabled={busy} className="mt-1">
        {t.admin.resetPasswordSubmit}
      </Button>
    </form>
  );
}
