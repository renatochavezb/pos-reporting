import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import { createClient } from "@/libs/supabase/server";
import { createAdminClient } from "@/libs/supabase/admin";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "renato.chavezb@gmail.com";
const esAdmin = (u) => (u?.email || "").toLowerCase() === ADMIN_EMAIL || u?.user_metadata?.role === "admin";

export async function GET() {
  const s = await auth();
  if (!s?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!esAdmin(s.user)) return NextResponse.json({ error: "Solo el administrador" }, { status: 403 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sucursal_accesos").select("sucursal,usuario,email,password_plano,actualizado_en").order("sucursal");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accesos: data || [] });
}

// Cambiar la contraseña de una sucursal (solo admin).
export async function POST(req) {
  const s = await auth();
  if (!s?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!esAdmin(s.user)) return NextResponse.json({ error: "Solo el administrador" }, { status: 403 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }
  const sucursal = String(body?.sucursal || "").toUpperCase().trim();
  const password = String(body?.password || "");
  if (!sucursal) return NextResponse.json({ error: "Falta la sucursal" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });

  const admin = createAdminClient();
  if (!admin)
    return NextResponse.json({ error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.", faltaKey: true }, { status: 400 });

  const supabase = await createClient();
  const { data: acc } = await supabase.from("sucursal_accesos").select("email").eq("sucursal", sucursal).maybeSingle();
  if (!acc?.email) return NextResponse.json({ error: "Sucursal sin acceso registrado" }, { status: 404 });

  const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const u = (lista?.users || []).find((x) => (x.email || "").toLowerCase() === acc.email.toLowerCase());
  if (!u) return NextResponse.json({ error: "No se encontró la cuenta" }, { status: 404 });

  const { error: upErr } = await admin.auth.admin.updateUserById(u.id, { password });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await admin.from("sucursal_accesos").update({ password_plano: password, actualizado_en: new Date().toISOString() }).eq("sucursal", sucursal);
  return NextResponse.json({ ok: true });
}
