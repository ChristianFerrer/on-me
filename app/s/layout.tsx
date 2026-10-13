import { getDeviceContext } from "@/lib/auth/device";

/**
 * Tema claro/oscuro de todas las pantallas de barra -ver /admin/ajustes-,
 * resuelto una sola vez aquí. Mismo criterio que app/admin/layout.tsx.
 */
export default async function BaristaLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getDeviceContext();

  return <div data-theme={ctx?.shop.theme} className="contents">{children}</div>;
}
