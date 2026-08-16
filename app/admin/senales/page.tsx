import { redirect } from "next/navigation";

/** Señales se juntó con las puertas en /admin/metricas; esto solo evita un 404 a quien tuviera la ruta vieja guardada. */
export default function SignalsRedirectPage() {
  redirect("/admin/metricas");
}
