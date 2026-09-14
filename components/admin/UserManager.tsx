"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EyeIcon, EyeOffIcon, TrashIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import type { ShopMember, ShopMemberRole } from "@/lib/auth/userAdmin";
import { fill, formatDateTime, type Dict, type Locale } from "@/lib/i18n";

type AdminDict = Dict["admin"];

const ERROR_KEYS: Record<string, keyof AdminDict> = {
  already_member: "userErrorExists",
  last_owner: "userErrorLastOwner",
  self: "userErrorSelf",
  bad_request: "userErrorEmail",
  not_found: "userErrorNotFound",
  generic: "userErrorGeneric",
};

function errorMessage(t: AdminDict, code: string | null): string | null {
  if (!code) return null;
  return t[ERROR_KEYS[code] ?? "userErrorGeneric"];
}

/**
 * Alta y gestión de admins del panel, desde el propio panel.
 *
 * Antes solo se podía dar acceso insertando a mano la fila en
 * `shop_members` -y la cuenta de Supabase Auth aparte, a mano también-.
 * Restablecer contraseña reutiliza el mismo email de recuperación que ya
 * usa /admin/constelacion-sol -sendPasswordReset-: no hay flujo de
 * invitación aparte que mantener. Bloquear usa `ban_duration` de la API de
 * admin de Supabase -el propio inicio de sesión ya lo respeta, no hace
 * falta ninguna comprobación extra en este código-. "Eliminar" solo quita
 * la fila de `shop_members` -el acceso a este local-, nunca la cuenta de
 * Supabase Auth: esa misma persona puede ser admin de otro local.
 */
export function UserManager({
  t,
  members,
  currentUserId,
  locale,
}: {
  t: AdminDict;
  members: ShopMember[];
  currentUserId: string;
  locale: Locale;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShopMemberRole>("operator");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    if (creating || !email.trim()) return;

    setCreating(true);
    setFormError(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (response.ok) {
        setEmail("");
        setRole("operator");
        router.refresh();
      } else {
        const data: unknown = await response.json().catch(() => null);
        const code = (data as { error?: string } | null)?.error ?? "generic";
        setFormError(errorMessage(t, code));
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={createUser} className="flex flex-col gap-2.5 sm:flex-row md:max-w-lg">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t.email}
          aria-label={t.email}
          autoComplete="off"
          className="field flex-1"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as ShopMemberRole)}
          aria-label={t.roleLabel}
          className="field sm:w-auto"
        >
          <option value="operator">{t.roleOperator}</option>
          <option value="owner">{t.roleOwner}</option>
        </select>
        <button
          type="submit"
          disabled={creating || !email.trim()}
          className="btn shrink-0 gap-1.5 bg-lime px-5 text-[0.9375rem] text-ink disabled:opacity-40"
        >
          {creating ? t.creating : t.addUser}
        </button>
      </form>

      {formError ? (
        <p role="alert" className="text-[0.875rem] font-medium text-coral">
          {formError}
        </p>
      ) : null}

      {members.length === 0 ? (
        <p className="text-[0.9375rem] text-chalk/45">{t.noUsers}</p>
      ) : (
        <>
          {/* Tarjetas: solo móvil. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {members.map((member) => (
              <UserRow
                key={member.id}
                t={t}
                member={member}
                currentUserId={currentUserId}
                locale={locale}
                onChanged={() => router.refresh()}
              />
            ))}
          </ul>

          {/* Tabla: desde md, una fila por admin en vez de una tarjeta completa. */}
          <div className="glass-dark hidden overflow-x-auto rounded-xl md:block">
            <table className="w-full text-left text-[0.8125rem]">
              <thead>
                <tr className="text-chalk/40">
                  <th className="px-3.5 py-2.5 font-medium">{t.email}</th>
                  <th className="px-3.5 py-2.5 font-medium">{t.roleLabel}</th>
                  <th className="px-3.5 py-2.5 font-medium">{t.usersLastLoginHeader}</th>
                  <th className="px-3.5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <UserTableRow
                    key={member.id}
                    t={t}
                    member={member}
                    currentUserId={currentUserId}
                    locale={locale}
                    onChanged={() => router.refresh()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/** Acciones compartidas entre la tarjeta de móvil y la fila de tabla de escritorio. */
function useUserActions(memberId: string, onChanged: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, init?: RequestInit): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(path, init);
      if (response.ok) {
        onChanged();
        return true;
      }
      const data: unknown = await response.json().catch(() => null);
      setError((data as { error?: string } | null)?.error ?? "generic");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    error,
    resetPassword: () => call(`/api/admin/users/${memberId}/reset-password`, { method: "POST" }),
    setPassword: (password: string) =>
      call(`/api/admin/users/${memberId}/password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      }),
    setBanned: (banned: boolean) =>
      call(`/api/admin/users/${memberId}/ban`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ banned }),
      }),
    setRole: (role: ShopMemberRole) =>
      call(`/api/admin/users/${memberId}/role`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      }),
    remove: () => call(`/api/admin/users/${memberId}`, { method: "DELETE" }),
  };
}

function lastLoginText(t: AdminDict, member: ShopMember, locale: Locale): string {
  return member.lastSignInAt
    ? fill(t.userLastLogin, { t: formatDateTime(member.lastSignInAt, locale) })
    : t.userNeverSignedIn;
}

function RoleBadge({ t, role }: { t: AdminDict; role: ShopMemberRole }) {
  return (
    <span
      className={cn(
        "eyebrow shrink-0 rounded-full px-2.5 py-1",
        role === "owner" ? "bg-lime/15 text-lime" : "bg-white/8 text-chalk/50",
      )}
    >
      {role === "owner" ? t.roleOwner : t.roleOperator}
    </span>
  );
}

/** Formulario inline para fijar la contraseña a mano -mismas reglas y textos que ResetPasswordForm.tsx, en vez de duplicarlos-, compartido entre la tarjeta de móvil y la fila de tabla. */
function PasswordForm({
  t,
  busy,
  onSubmit,
  onCancel,
}: {
  t: AdminDict;
  busy: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setLocalError(t.resetPasswordTooShort);
      return;
    }
    if (password !== confirm) {
      setLocalError(t.resetPasswordMismatch);
      return;
    }
    setLocalError(null);
    onSubmit(password);
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2.5 rounded-xl bg-ink-2 p-4">
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t.password}
          aria-label={t.password}
          autoComplete="new-password"
          className="field pr-11"
        />
        <button
          type="button"
          onClick={() => setShow((value) => !value)}
          aria-label={show ? t.hidePassword : t.showPassword}
          aria-pressed={show}
          className="absolute inset-y-0 right-1 flex items-center px-2 text-chalk/45 hover:text-chalk"
        >
          {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </div>
      <input
        type={show ? "text" : "password"}
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        placeholder={t.resetPasswordConfirmLabel}
        aria-label={t.resetPasswordConfirmLabel}
        autoComplete="new-password"
        className="field"
      />
      {localError ? (
        <p role="alert" className="text-[0.8125rem] font-medium text-coral">
          {localError}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn bg-white/8 px-4 py-2.5 text-[0.8125rem] text-chalk"
        >
          {t.cancel}
        </button>
        <button
          type="submit"
          disabled={busy}
          className="btn bg-lime px-4 py-2.5 text-[0.8125rem] text-ink disabled:opacity-40"
        >
          {t.resetPasswordSubmit}
        </button>
      </div>
    </form>
  );
}

function UserRow({
  t,
  member,
  currentUserId,
  locale,
  onChanged,
}: {
  t: AdminDict;
  member: ShopMember;
  currentUserId: string;
  locale: Locale;
  onChanged: () => void;
}) {
  const isSelf = member.userId === currentUserId;
  const { busy, error, resetPassword, setPassword, setBanned, setRole, remove } = useUserActions(
    member.id,
    onChanged,
  );
  const [resetSent, setResetSent] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  async function handleResetPassword() {
    if (await resetPassword()) {
      setResetSent(true);
      window.setTimeout(() => setResetSent(false), 3000);
    }
  }

  async function handleSetPassword(password: string) {
    if (await setPassword(password)) {
      setPwOpen(false);
      setPwSaved(true);
      window.setTimeout(() => setPwSaved(false), 3000);
    }
  }

  function handleRemove() {
    if (window.confirm(t.confirmRemoveUser)) void remove();
  }

  return (
    <li className="glass-dark rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[1.0625rem] font-semibold">
            {member.email}
            {isSelf ? (
              <span className="ml-1.5 text-[0.8125rem] font-normal text-chalk/40">
                {t.userYou}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-[0.8125rem] text-chalk/45">
            {lastLoginText(t, member, locale)}
            {pwSaved ? ` · ${t.passwordSaved}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <RoleBadge t={t} role={member.role} />
          {member.banned ? (
            <span className="eyebrow rounded-full bg-coral/15 px-2.5 py-1 text-coral">
              {t.userBanned}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <select
          value={member.role}
          onChange={(event) => void setRole(event.target.value as ShopMemberRole)}
          disabled={busy}
          aria-label={t.roleLabel}
          className="field w-auto px-3 py-2.5 text-[0.8125rem]"
        >
          <option value="operator">{t.roleOperator}</option>
          <option value="owner">{t.roleOwner}</option>
        </select>
        <button
          type="button"
          onClick={() => setPwOpen((value) => !value)}
          disabled={busy}
          className="btn bg-ink-2 px-4 py-3 text-[0.8125rem] text-chalk"
        >
          {t.setPasswordAction}
        </button>
        <button
          type="button"
          onClick={() => void handleResetPassword()}
          disabled={busy}
          className="btn bg-ink-2 px-4 py-3 text-[0.8125rem] text-chalk"
        >
          {resetSent ? t.userResetPasswordSent : t.userResetPassword}
        </button>
        <button
          type="button"
          onClick={() => void setBanned(!member.banned)}
          disabled={busy || isSelf}
          className={cn(
            "btn px-4 py-3 text-[0.8125rem] disabled:opacity-40",
            member.banned ? "bg-lime/15 text-lime" : "bg-amber/15 text-amber",
          )}
        >
          {member.banned ? t.unblockUser : t.blockUser}
        </button>
        <button
          type="button"
          onClick={handleRemove}
          disabled={busy || isSelf}
          className="btn gap-1.5 bg-coral/15 px-4 py-3 text-[0.8125rem] text-coral disabled:opacity-40"
        >
          <TrashIcon className="size-4" />
          {t.removeUser}
        </button>
      </div>

      {pwOpen ? (
        <PasswordForm
          t={t}
          busy={busy}
          onSubmit={(password) => void handleSetPassword(password)}
          onCancel={() => setPwOpen(false)}
        />
      ) : null}

      {error ? (
        <p role="alert" className="mt-2.5 text-[0.8125rem] font-medium text-coral">
          {errorMessage(t, error)}
        </p>
      ) : null}
    </li>
  );
}

/** Misma fila que UserRow, pero como <tr> -para la tabla de escritorio-: comparte lógica vía useUserActions, no JSX. */
function UserTableRow({
  t,
  member,
  currentUserId,
  locale,
  onChanged,
}: {
  t: AdminDict;
  member: ShopMember;
  currentUserId: string;
  locale: Locale;
  onChanged: () => void;
}) {
  const isSelf = member.userId === currentUserId;
  const { busy, error, resetPassword, setPassword, setBanned, setRole, remove } = useUserActions(
    member.id,
    onChanged,
  );
  const [resetSent, setResetSent] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  async function handleResetPassword() {
    if (await resetPassword()) {
      setResetSent(true);
      window.setTimeout(() => setResetSent(false), 3000);
    }
  }

  async function handleSetPassword(password: string) {
    if (await setPassword(password)) {
      setPwOpen(false);
      setPwSaved(true);
      window.setTimeout(() => setPwSaved(false), 3000);
    }
  }

  function handleRemove() {
    if (window.confirm(t.confirmRemoveUser)) void remove();
  }

  return (
    <>
      <tr className="border-t border-white/8">
        <td className="max-w-56 px-3.5 py-3 font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="truncate">{member.email}</span>
            {isSelf ? (
              <span className="shrink-0 font-normal text-chalk/40">{t.userYou}</span>
            ) : null}
            {member.banned ? (
              <span className="eyebrow shrink-0 rounded-full bg-coral/15 px-2 py-0.5 text-coral">
                {t.userBanned}
              </span>
            ) : null}
          </div>
        </td>
        <td className="px-3.5 py-3">
          <select
            value={member.role}
            onChange={(event) => void setRole(event.target.value as ShopMemberRole)}
            disabled={busy}
            aria-label={t.roleLabel}
            className="field w-auto px-2.5 py-2 text-[0.8125rem]"
          >
            <option value="operator">{t.roleOperator}</option>
            <option value="owner">{t.roleOwner}</option>
          </select>
        </td>
        <td className="px-3.5 py-3 text-chalk/60">
          {lastLoginText(t, member, locale)}
          {pwSaved ? ` · ${t.passwordSaved}` : ""}
        </td>
        <td className="px-3.5 py-3 text-right">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setPwOpen((value) => !value)}
              disabled={busy}
              className="btn bg-ink-2 px-3 py-2 text-[0.8125rem] text-chalk"
            >
              {t.setPasswordAction}
            </button>
            <button
              type="button"
              onClick={() => void handleResetPassword()}
              disabled={busy}
              className="btn bg-ink-2 px-3 py-2 text-[0.8125rem] text-chalk"
            >
              {resetSent ? t.userResetPasswordSent : t.userResetPassword}
            </button>
            <button
              type="button"
              onClick={() => void setBanned(!member.banned)}
              disabled={busy || isSelf}
              className={cn(
                "btn px-3 py-2 text-[0.8125rem] disabled:opacity-40",
                member.banned ? "bg-lime/15 text-lime" : "bg-amber/15 text-amber",
              )}
            >
              {member.banned ? t.unblockUser : t.blockUser}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy || isSelf}
              className="btn bg-coral/15 px-3 py-2 text-[0.8125rem] text-coral disabled:opacity-40"
            >
              {t.removeUser}
            </button>
          </div>
        </td>
      </tr>

      {pwOpen ? (
        <tr className="border-t border-white/8">
          <td colSpan={4} className="p-4">
            <PasswordForm
              t={t}
              busy={busy}
              onSubmit={(password) => void handleSetPassword(password)}
              onCancel={() => setPwOpen(false)}
            />
          </td>
        </tr>
      ) : null}

      {error ? (
        <tr className="border-t border-white/8">
          <td colSpan={4} className="px-3.5 py-2.5 text-[0.8125rem] font-medium text-coral">
            {errorMessage(t, error)}
          </td>
        </tr>
      ) : null}
    </>
  );
}
