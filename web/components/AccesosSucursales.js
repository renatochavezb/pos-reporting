"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function AccesosSucursales() {
  const [accesos, setAccesos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState("");
  const [ver, setVer] = useState({});         // sucursal -> bool (mostrar contraseña)
  const [editando, setEditando] = useState(null); // sucursal en edición
  const [nueva, setNueva] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/accesos");
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "No se pudo cargar"); setAccesos([]); }
      else { setAccesos(d.accesos || []); setErr(""); }
    } catch { setErr("No se pudo cargar"); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  const copiar = async (txt) => { try { await navigator.clipboard.writeText(txt); toast.success("Copiado"); } catch { toast.error("No se pudo copiar"); } };

  const cambiar = async (sucursal) => {
    setGuardando(true);
    try {
      const r = await fetch("/api/accesos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sucursal, password: nueva }),
      });
      const d = await r.json();
      if (!r.ok) toast.error(d.faltaKey ? "Falta configurar la llave del servidor (service_role)" : (d.error || "No se pudo cambiar"));
      else { toast.success("Contraseña actualizada"); setEditando(null); setNueva(""); cargar(); }
    } catch { toast.error("Error de red"); }
    setGuardando(false);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-4 rounded-full bg-[var(--primary)]" />
        <h2 className="font-headline text-2xl text-[var(--on-surface)]">Accesos de sucursales</h2>
        <span className="ml-2 text-xs text-[var(--on-surface-variant)]">usuario y contraseña de cada tienda</span>
      </div>

      <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[var(--surface-container-low)]">
              <tr className="font-label text-[10px] uppercase tracking-wider text-[var(--on-surface-variant)]">
                <th className="px-4 py-3 font-medium">Sucursal</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Contraseña</th>
                <th className="px-4 py-3 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="text-[var(--on-surface)]">
              {cargando ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--on-surface-variant)]">Cargando…</td></tr>
              ) : err ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--error)]">{err}</td></tr>
              ) : accesos.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--on-surface-variant)]">Sin accesos registrados</td></tr>
              ) : (
                accesos.map((a) => (
                  <tr key={a.sucursal} className="border-t border-[var(--outline-variant)]/60 align-top">
                    <td className="px-4 py-2.5 font-medium capitalize">{a.sucursal.toLowerCase()}</td>
                    <td className="px-4 py-2.5">
                      <span className="tnum">{a.usuario}</span>
                      <button onClick={() => copiar(a.usuario)} className="ml-2 text-xs text-[var(--on-surface-variant)] hover:text-[var(--primary)]">copiar</button>
                    </td>
                    <td className="px-4 py-2.5">
                      {editando === a.sucursal ? (
                        <div className="flex items-center gap-2">
                          <input value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva (mín. 6)" className="rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-2 py-1.5 text-sm w-32 outline-none focus:border-[var(--primary)]" />
                          <button onClick={() => cambiar(a.sucursal)} disabled={guardando} className="text-xs font-semibold text-[var(--primary)] disabled:opacity-50">Guardar</button>
                          <button onClick={() => { setEditando(null); setNueva(""); }} className="text-xs text-[var(--on-surface-variant)]">Cancelar</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="tnum">{ver[a.sucursal] ? a.password_plano : "••••••••"}</span>
                          <button onClick={() => setVer((v) => ({ ...v, [a.sucursal]: !v[a.sucursal] }))} className="text-xs text-[var(--on-surface-variant)] hover:text-[var(--primary)]">{ver[a.sucursal] ? "ocultar" : "ver"}</button>
                          <button onClick={() => copiar(a.password_plano)} className="text-xs text-[var(--on-surface-variant)] hover:text-[var(--primary)]">copiar</button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {editando === a.sucursal ? null : (
                        <button onClick={() => { setEditando(a.sucursal); setNueva(""); }} className="text-xs font-semibold text-[var(--primary)] hover:underline">Cambiar</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-[var(--on-surface-variant)]">
        El encargado entra en su celular escribiendo <b>solo el nombre de su sucursal</b> (el usuario) y su contraseña. Solo tú (administrador) ves y cambia estas claves.
      </p>
    </section>
  );
}
