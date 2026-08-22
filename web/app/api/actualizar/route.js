import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const run = promisify(execFile);
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let sucursal = null;
  try { const b = await req.json(); if (typeof b?.sucursal === "string") sucursal = b.sucursal; } catch {}

  const cwd = path.join(process.cwd(), "..", "extractor");
  const opts = { cwd, timeout: 90000, windowsHide: true, maxBuffer: 1024 * 1024 };
  try {
    // 1) extraer la merma (una sucursal o todas)
    const args = ["extraer_merma.mjs"];
    if (sucursal) args.push(sucursal);
    const { stdout } = await run(process.execPath, args, opts);
    // 2) regenerar equivalencias (valoriza productos nuevos)
    await run(process.execPath, ["regenerar_equivalencias.mjs"], opts);
    const lineas = String(stdout).trim().split("\n").filter(Boolean);
    return NextResponse.json({ ok: true, salida: lineas.slice(-6) });
  } catch (e) {
    return NextResponse.json({ error: e?.stderr || e?.message || "Error al actualizar" }, { status: 500 });
  }
}
