import { ResetPasswordForm } from "@/components/admin/ResetPasswordForm";
import { Logo } from "@/components/ui/Logo";
import { Screen } from "@/components/ui/Screen";
import { getI18n } from "@/lib/i18n/server";

/**
 * Destino del enlace de recuperación de contraseña de Supabase Auth -ver
 * lib/auth/admin.ts, sendPasswordReset-. Ruta pública a propósito: nadie
 * llega aquí con sesión de panel todavía, es justo lo contrario, la persona
 * la perdió o se le olvidó la contraseña.
 */
export default async function ResetPasswordPage() {
  const { t } = await getI18n();

  return (
    <Screen tone="ink" className="gap-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <Logo size="lg" tone="chalk" />
        <div className="w-full max-w-[22rem]">
          <p className="eyebrow mb-4 text-center text-chalk/45">
            {t.admin.resetPasswordTitle}
          </p>
          <ResetPasswordForm t={t} />
        </div>
      </div>
    </Screen>
  );
}
