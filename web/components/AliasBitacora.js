"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

export default function AliasBitacora() {
  const [alias, setAlias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState("");
  const [texto, setTexto] = useState("");
  const [productoNorm, setProductoNorm] = useState("");
  const [tamano, setTamano] = useState("");
  const [region, setRegion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/alias");
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "No se pudo cargar"); }
      else { setAlias(d.alias || []); setProductos(d.productos || []); setErr(""); }
    } catch { setErr("No se pudo cargar"); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  // Productos únicos (por nombre de catálogo) para el selector.
  const opciones = useMemo(() => {
    const m = new Map();
    for (const p of productos) if (!m.has(p.producto_norm)) m.set(p.producto_norm, p.producto);
    return [...m.entries()].map(([norm, disp]) => ({ norm, disp })).sort((a, b) => String(a.disp).localeCompare(String(b.disp)));
  }, [productos]);

  const dispDe = (norm) => opciones.find((o) => o.norm === norm)?.disp || norm;

  const agregar = async (e) => {
    e.preventDefault();
    if (!texto.trim() || !productoNorm) { toast.error("Escribe el texto y elige el producto"); return; }
    setGuardando(true);
    try {
      const r = await fetch("/api/alias", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: texto.trim(), producto_norm: productoNorm, tamano: tamano || null, region: region || null }),
      });
      const d = await r.json();
      if (!r.ok) toast.error(d.error || "No se pudo guardar");
      else { toast.success("Alias guardado"); setTexto(""); setProductoNorm(""); setTamano(""); setRegion(""); cargar(); }
    } catch { toast.error("Error de red"); }
    setGuardando(false);
  };

  const borrar = async (a) => {
    if (!confirm(`¿Borrar el alias "${a.texto}"?`)) return;
    try {
      const r = await fetch(`/api/alias?id=${encodeURIComponent(a.id)}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) toast.error(d.error || "No se pudo borrar");
      else { toast.success("Borrado"); cargar(); }
    } catch { toast.error("Error de red"); }
  };

  const inputCls = "w-full rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)]";

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-4 rounded-full bg-[var(--primary)]" />
        <h2 className="font-headline text-2xl text-[var(--on-surface)]">Diccionario de nombres</h2>
        <span className="ml-2 text-xs text-[var(--on-surface-variant)]">enseña a la IA los apodos de la bitácora</span>
      </div>
      <p className="text-sm text-[var(--on-surface-variant)] -mt-2">
        Cuando el personal escribe un nombre corto o ambiguo (ej. <b>"Lotus G"</b>), aquí le dices a qué producto del catálogo corresponde. La transcripción lo respeta siempre.
      </p>

      {/* Alta */}
      <form onSubmit={agregar} className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5 grid sm:grid-cols-[1fr_1.3fr_auto_auto_auto] gap-3 items-end">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-[var(--on-surface-variant)]">Cuando escriban…</span>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Lotus G" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-[var(--on-surface-variant)]">…es este producto</span>
          <select value={productoNorm} onChange={(e) => setProductoNorm(e.target.value)} className={inputCls}>
            <option value="">Elige…</option>
            {opciones.map((o) => <option key={o.norm} value={o.norm}>{o.disp}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-[var(--on-surface-variant)]">Tamaño</span>
          <select value={tamano} onChange={(e) => setTamano(e.target.value)} className={inputCls}>
            <option value="">Cualquiera</option>
            <option value="GD">Grande</option>
            <option value="CH">Chico</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-[var(--on-surface-variant)]">Región</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls}>
            <option value="">Ambas</option>
            <option value="CHIHUAHUA">Chihuahua</option>
            <option value="JUAREZ">Juárez</option>
          </select>
        </label>
        <button type="submit" disabled={guardando} className="rounded-full px-5 py-2 font-label text-sm font-semibold bg-[var(--primary)] text-[var(--on-primary)] hover:opacity-90 disabled:opacity-60">
          {guardando ? "…" : "Agregar"}
        </button>
      </form>

      {/* Lista */}
      <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[var(--surface-container-low)]">
              <tr className="font-label text-[10px] uppercase tracking-wider text-[var(--on-surface-variant)]">
                <th className="px-4 py-3 font-medium">Cuando escriban</th>
                <th className="px-4 py-3 font-medium">Es el producto</th>
                <th className="px-4 py-3 font-medium">Tamaño</th>
                <th className="px-4 py-3 font-medium">Región</th>
                <th className="px-4 py-3 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="text-[var(--on-surface)]">
              {cargando ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--on-surface-variant)]">Cargando…</td></tr>
              ) : err ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--error)]">{err}</td></tr>
              ) : alias.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--on-surface-variant)]">Aún no hay alias. Agrega el primero arriba.</td></tr>
              ) : (
                alias.map((a) => (
                  <tr key={a.id} className="border-t border-[var(--outline-variant)]/60">
                    <td className="px-4 py-2.5 font-medium">{a.texto}</td>
                    <td className="px-4 py-2.5">{dispDe(a.producto_norm)}</td>
                    <td className="px-4 py-2.5 text-[var(--on-surface-variant)]">{a.tamano === "GD" ? "Grande" : a.tamano === "CH" ? "Chico" : "—"}</td>
                    <td className="px-4 py-2.5 text-[var(--on-surface-variant)]">{a.region ? (a.region === "JUAREZ" ? "Juárez" : "Chihuahua") : "Ambas"}</td>
                    <td className="px-4 py-2.5 text-right"><button onClick={() => borrar(a)} className="text-xs font-semibold text-[var(--error)] hover:underline">Borrar</button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
