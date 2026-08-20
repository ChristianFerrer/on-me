import { redirect } from "next/navigation";

/** La portada del panel se mudó a /admin/constelacion-sol -la vista sol reemplaza al viejo diagrama de burbujas de ConstelacionMap-; esto solo evita un 404 a quien tuviera /admin guardado. */
export default function AdminPage() {
  redirect("/admin/constelacion-sol");
}
