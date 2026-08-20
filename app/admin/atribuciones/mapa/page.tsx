import { redirect } from "next/navigation";

/** La constelación se mudó a la portada del panel (/admin/constelacion-sol); esto solo evita un 404 a quien tuviera la ruta vieja guardada. */
export default function ReferralMapRedirectPage() {
  redirect("/admin/constelacion-sol");
}
