import { getAdminContext } from "@/lib/auth/admin";

/**
 * Tema claro/oscuro de todo el panel -ver /admin/ajustes-, resuelto una
 * sola vez aquí para que ninguna página de /admin/* tenga que repetir la
 * consulta. Sin sesión -portada de login- no hay local que preguntar,
 * así que se queda en el oscuro de siempre: el valor por defecto de
 * app/globals.css.
 *
 * `display: contents` a propósito: el wrapper no debe participar del
 * layout -ni cajas ni márgenes propios-, solo llevar el atributo que lee
 * la hoja de estilos.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();

  return <div data-theme={ctx?.shop.theme} className="contents">{children}</div>;
}
