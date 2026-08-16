import { redirect } from "next/navigation";

/** El embudo se juntó con las puertas y las señales en /admin/metricas; esto solo evita un 404 a quien tuviera la ruta vieja guardada. */
export default function FunnelRedirectPage() {
  redirect("/admin/metricas");
}
