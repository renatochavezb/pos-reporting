import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import { createAdminClient } from "@/libs/supabase/admin";

export const dynamic = "force-dynamic";

// Correo del administrador: aparece siempre y NO se puede eliminar.
const ADMIN_EMAIL = "renato.chavezb@gmail.com";
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Verifica que quien llama sea el administrador y devuelve el cliente admin.
async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado", status: 401 };
  if ((session.user.email || "").toLowerCase() !== ADMIN_EMAIL)
    return { error: "Solo el administrador puede gestionar autorizaciones", status: 403 };
  const admin = createAdminClient();
  if (!admin)
    return { error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.", status: 400, faltaKey: true };
  return { admin };
}

export async function GET() {
  const g = await requireAdmin();
  if (g.error) return NextResponse.json({ error: g.error, faltaKey: g.faltaKey }, { status: g.status });

  const { data, error } = await g.admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const usuarios = (data?.users || [])
    .map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      ultimo_acceso: u.last_sign_in_at || null,
      es_admin: (u.email || "").toLowerCase() === ADMIN_EMAIL,
    }))
    .sort((a, b) => (b.es_admin - a.es_admin) || String(a.email).localeCompare(String(b.email)));

  return NextResponse.json({ usuarios, adminEmail: ADMIN_EMAIL });
}

// Autorizar un correo (crear) o cambiarle la contraseña (si ya existe).
export async function POST(req) {
  const g = await requireAdmin();
  if (g.error) return NextResponse.json({ error: g.error, faltaKey: g.faltaKey }, { status: g.status });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 }); }
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  if (!emailOk(email)) return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });

  const { data: lista } = await g.admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existente = (lista?.users || []).find((u) => (u.email || "").toLowerCase() === email);

  if (existente) {
    const { error } = await g.admin.auth.admin.updateUserById(existente.id, { password, email_confirm: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, actualizado: true, email });
  }

  const { error } = await g.admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, creado: true, email });
}

// Quitar el acceso de un correo (no se permite borrar al administrador).
export async function DELETE(req) {
  const g = await requireAdmin();
  if (g.error) return NextResponse.json({ error: g.error, faltaKey: g.faltaKey }, { status: g.status });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const { data: u } = await g.admin.auth.admin.getUserById(id);
  if ((u?.user?.email || "").toLowerCase() === ADMIN_EMAIL)
    return NextResponse.json({ error: "No se puede eliminar la cuenta del administrador" }, { status: 400 });

  const { error } = await g.admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
