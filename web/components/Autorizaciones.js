"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

const fecha = (iso) =>
  !iso ? "—" : new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

export default function Autorizaciones() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [faltaKey, setFaltaKey] = useState(false);
  const [errCarga, setErrCarga] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/usuarios");
      const d = await r.json();
      if (!r.ok) {
        setFaltaKey(!!d.faltaKey);
        setErrCarga(d.error || "No se pudo cargar la lista");
        setUsuarios([]);
      } else {
        setUsuarios(d.usuarios || []);
        setErrCarga("");
        setFaltaKey(false);
      }
    } catch {
      setErrCarga("No se pudo cargar la lista");
    }
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const agregar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const r = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!r.ok) toast.error(d.error || "No se pudo autorizar");
      else {
        toast.success(d.actualizado ? "Contraseña actualizada" : "Correo autorizado");
        setEmail(""); setPassword("");
        cargar();
      }
    } catch { toast.error("Error de red"); }
    setGuardando(false);
  };

  const borrar = async (u) => {
    if (!confirm(`¿Quitar el acceso de ${u.email}?`)) return;
    try {
      const r = await fetch(`/api/usuarios?id=${encodeURIComponent(u.id)}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) toast.error(d.error || "No se pudo eliminar");
      else { toast.success("Acceso eliminado"); cargar(); }
    } catch { toast.error("Error de red"); }
  };

  const inputCls =
    "w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-4 py-2.5 text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] outline-none transition-colors focus:border-[var(--primary)]";

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-4 rounded-full bg-[var(--primary)]" />
        <h2 className="font-headline text-2xl text-[var(--on-surface)]">Autorizaciones</h2>
        <span className="ml-2 text-xs text-[var(--on-surface-variant)]">quién puede entrar al sistema</span>
      </div>

      {faltaKey ? (
        <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5 text-sm text-[var(--on-surface-variant)] flex flex-col gap-2">
          <p className="font-semibold text-[var(--on-surface)]">Falta un paso de configuración</p>
          <p>Para gestionar las cuentas desde aquí, agrega la variable <code>SUPABASE_SERVICE_ROLE_KEY</code> en el servidor (la encuentras en Supabase → Settings → API → <b>service_role</b>).</p>
          <p>Agrégala en <code>web/.env.local</code> (local) y en las variables de entorno de Vercel, luego vuelve a desplegar.</p>
        </div>
      ) : (
        <>
          {/* Alta / cambio de contraseña */}
          <form onSubmit={agregar} className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5 flex flex-col gap-3">
            <p className="eyebrow">Autorizar un correo</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <input type="email" required placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              <div className="relative">
                <input type={verPass ? "text" : "password"} required placeholder="Contraseña (mín. 6)" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls + " pr-16"} />
                <button type="button" onClick={() => setVerPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--on-surface-variant)] hover:text-[var(--primary)]">
                  {verPass ? "ocultar" : "ver"}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-[var(--on-surface-variant)]">Si el correo ya existe, se le actualiza la contraseña.</p>
              <button type="submit" disabled={guardando} className="rounded-full px-6 py-2.5 font-label text-sm font-semibold bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90 transition disabled:opacity-60">
                {guardando ? "Guardando…" : "Autorizar"}
              </button>
            </div>
          </form>

          {/* Lista de autorizados */}
          <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] overflow-hidden">
            <div className="px-5 pt-5 pb-3"><p className="eyebrow">Correos autorizados</p></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[var(--surface-container-low)]">
                  <tr className="font-label text-[10px] uppercase tracking-wider text-[var(--on-surface-variant)]">
                    <th className="px-4 py-3 font-medium">Correo</th>
                    <th className="px-4 py-3 font-medium">Alta</th>
                    <th className="px-4 py-3 font-medium">Último acceso</th>
                    <th className="px-4 py-3 font-medium text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--on-surface)]">
                  {cargando ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--on-surface-variant)]">Cargando…</td></tr>
                  ) : errCarga ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--error)]">{errCarga}</td></tr>
                  ) : usuarios.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--on-surface-variant)]">Sin usuarios</td></tr>
                  ) : (
                    usuarios.map((u) => (
                      <tr key={u.id} className="border-t border-[var(--outline-variant)]/60">
                        <td className="px-4 py-2.5">
                          <span className="font-medium">{u.email}</span>
                          {u.es_admin && (
                            <span className="ml-2 rounded-full bg-[var(--primary-container)] text-[var(--on-primary-container)] text-[10px] font-semibold px-2 py-0.5 align-middle">Administrador</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--on-surface-variant)]">{fecha(u.created_at)}</td>
                        <td className="px-4 py-2.5 text-[var(--on-surface-variant)]">{fecha(u.ultimo_acceso)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {u.es_admin ? (
                            <span className="text-xs text-[var(--muted-soft)]">—</span>
                          ) : (
                            <button onClick={() => borrar(u)} className="text-xs font-semibold text-[var(--error)] hover:underline">Quitar acceso</button>
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
            Estos correos entran con <b>correo y contraseña</b> en la pantalla de acceso. Tu cuenta de administrador no se puede eliminar.
          </p>
        </>
      )}
    </section>
  );
}
