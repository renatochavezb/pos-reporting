import { redirect } from "next/navigation";
import { auth } from "@/libs/auth";

export const dynamic = "force-dynamic";

// Candado por rol: las secciones de administración (dashboard, precios, nvo,
// ajustes) son solo para el admin. Un usuario de sucursal se manda a su
// pantalla de captura.
export default async function UserLayout({ children }) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.user_metadata?.role === "sucursal") redirect("/captura");
  return children;
}
