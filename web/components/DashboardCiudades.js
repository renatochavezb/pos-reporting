"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const pesos0 = (n) =>
  n == null ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
const titulo = (s) => String(s || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function parts(dstr) {
  const [y, m, d] = dstr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { y, m, d, dt, dow: (dt.getUTCDay() + 6) % 7 };
}
function mondayOf(dstr) {
  const { dt, dow } = parts(dstr);
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}
function isoWeek(dstr) {
  const { dt } = parts(dstr);
  const t = new Date(dt);
  const dn = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dn + 3);
  const f = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t - f) / 864e5 - 3 + ((f.getUTCDay() + 6) % 7)) / 7);
}
function addDays(dstr, n) {
  const { dt } = parts(dstr);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
const etiqDia = (dstr) => {
  const { d, m } = parts(dstr);
  return `${d} ${MESES[m - 1]}`;
};

function TablaCiudad({ ciudad, filas }) {
  const suma = (k) => filas.reduce((a, x) => a + x[k], 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-4 rounded-full bg-[var(--primary)]" />
        <h2 className="font-headline text-2xl text-[var(--on-surface)]">{ciudad}</h2>
        <span className="ml-auto tnum text-sm text-[var(--on-surface-variant)]">{filas.length} sucursales</span>
      </div>
      <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--surface-container-low)]">
              <tr className="font-label text-[10px] uppercase tracking-wider text-[var(--on-surface-variant)]">
                <th className="px-3 py-3 font-medium">Sucursal</th>
                <th className="px-3 py-3 font-medium text-right">Ren.</th>
                <th className="px-3 py-3 font-medium text-right" style={{ color: "var(--primary)" }}>Caducidad</th>
                <th className="px-3 py-3 font-medium text-right" style={{ color: "var(--error)" }}>Daño</th>
                <th className="px-3 py-3 font-medium text-right">Total</th>
                <th className="px-3 py-3 font-medium text-right">Público</th>
              </tr>
            </thead>
            <tbody className="text-[13px] text-[var(--on-surface)]">
              {filas.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--on-surface-variant)]">Sin bitácora en estas semanas</td></tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.sucursal} className="border-t border-[var(--outline-variant)]/60 hover:bg-[var(--surface-container-low)]/50">
                    <td className="px-3 py-2.5">
                      <Link href={`/nvo/${encodeURIComponent(f.sucursal)}`} className="hover:text-[var(--primary)] transition-colors">{titulo(f.sucursal)}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-right tnum text-[var(--on-surface-variant)]">{f.renglones}</td>
                    <td className="px-3 py-2.5 text-right tnum">{f.caducidad > 0 ? pesos0(f.caducidad) : "—"}</td>
                    <td className="px-3 py-2.5 text-right tnum">{f.dano > 0 ? pesos0(f.dano) : "—"}</td>
                    <td className="px-3 py-2.5 text-right tnum font-semibold">{pesos0(f.costo)}</td>
                    <td className="px-3 py-2.5 text-right tnum text-[var(--on-surface-variant)]">{f.publico > 0 ? pesos0(f.publico) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
            {filas.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--outline-variant)] font-semibold text-[13px]">
                  <td className="px-3 py-3">Total {ciudad}</td>
                  <td className="px-3 py-3 text-right tnum">{suma("renglones")}</td>
                  <td className="px-3 py-3 text-right tnum" style={{ color: "var(--primary)" }}>{pesos0(suma("caducidad"))}</td>
                  <td className="px-3 py-3 text-right tnum" style={{ color: "var(--error)" }}>{pesos0(suma("dano"))}</td>
                  <td className="px-3 py-3 text-right tnum">{pesos0(suma("costo"))}</td>
                  <td className="px-3 py-3 text-right tnum">{suma("publico") > 0 ? pesos0(suma("publico")) : "—"}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DashboardCiudades({ rows, regionDe }) {
  const weeks = useMemo(() => {
    const set = new Map();
    for (const r of rows || []) {
      const day = String(r.fecha || "").slice(0, 10);
      if (!day) continue;
      const mon = mondayOf(day);
      if (!set.has(mon)) set.set(mon, { monday: mon, num: isoWeek(day) });
    }
    return [...set.values()].sort((a, b) => (a.monday < b.monday ? -1 : 1));
  }, [rows]);

  const [sel, setSel] = useState({ a: null, b: null });
  const clickWeek = (i) => setSel((s) => (s.a === null || s.b !== null ? { a: i, b: null } : { a: s.a, b: i }));
  const reset = () => setSel({ a: null, b: null });

  const hasSel = sel.a !== null;
  const start = hasSel ? Math.min(sel.a, sel.b ?? sel.a) : 0;
  const end = hasSel ? Math.max(sel.a, sel.b ?? sel.a) : Math.max(0, weeks.length - 1);
  const eligiendo = hasSel && sel.b === null;
  const desde = weeks.length ? weeks[start].monday : null;
  const hasta = weeks.length ? addDays(weeks[end].monday, 6) : null;

  const filt = useMemo(
    () => (rows || []).filter((r) => { const d = String(r.fecha || "").slice(0, 10); return desde && d >= desde && d <= hasta; }),
    [rows, desde, hasta]
  );

  const { chi, jrz, tot } = useMemo(() => {
    const agg = {};
    for (const b of filt) {
      const e = agg[b.sucursal] || (agg[b.sucursal] = { sucursal: b.sucursal, region: regionDe[b.sucursal] || "SIN ZONA", renglones: 0, costo: 0, publico: 0, caducidad: 0, dano: 0 });
      const costo = Number(b.importe_costo || 0);
      e.renglones += 1;
      e.costo += costo;
      e.publico += Number(b.precio_publico || 0) * Number(b.cantidad || 0);
      if (b.motivo_tipo === "caducidad") e.caducidad += costo;
      else if (b.motivo_tipo === "daño" || b.motivo_tipo === "dano") e.dano += costo;
    }
    const lista = Object.values(agg);
    const chi = lista.filter((x) => x.region === "CHIHUAHUA").sort((a, b) => b.costo - a.costo);
    const jrz = lista.filter((x) => x.region === "JUAREZ").sort((a, b) => b.costo - a.costo);
    const sum = (arr, k) => arr.reduce((a, x) => a + x[k], 0);
    const zona = (arr) => ({ costo: sum(arr, "costo"), caducidad: sum(arr, "caducidad"), dano: sum(arr, "dano"), n: arr.length });
    return { chi, jrz, tot: { chi: zona(chi), jrz: zona(jrz), all: zona(lista) } };
  }, [filt, regionDe]);

  const nSel = end - start + 1;
  const etiqueta = !weeks.length ? "sin datos" : `${!hasSel ? "Todas · " : ""}${etiqDia(desde)} → ${etiqDia(hasta)} · ${nSel} sem`;

  return (
    <div className="flex flex-col gap-6">
      {/* Selector de semanas */}
      <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2 px-1">
          <p className="text-xs text-[var(--on-surface-variant)]">
            {eligiendo ? "Elige la semana final del rango…" : "Clic en una semana para elegirla · clic en otra para un rango"}
          </p>
          <button
            onClick={reset}
            className={`px-3 py-1 rounded-full font-label text-[11px] transition-colors ${
              !hasSel ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--on-surface-variant)] border border-[var(--outline-variant)] hover:bg-[var(--surface-container-low)]"
            }`}
          >
            Todas
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {weeks.map((w, i) => {
            const activo = hasSel && i >= start && i <= end;
            return (
              <button
                key={w.monday}
                onClick={() => clickWeek(i)}
                className={`flex flex-col items-start px-3 py-2 rounded-xl border whitespace-nowrap transition-colors ${
                  activo
                    ? "bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]"
                    : "border-[var(--outline-variant)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)]"
                }`}
              >
                <span className="font-label text-[11px] tracking-wide">Sem {w.num}</span>
                <span className="tnum text-[11px]">{etiqDia(w.monday)}–{etiqDia(addDays(w.monday, 6))}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--on-surface-variant)] mt-2 px-1 tnum">Periodo: {etiqueta}</p>
      </div>

      {/* KPIs por ciudad (con desglose caducidad / daño) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { lab: "Chihuahua", d: tot.chi, big: "text-[var(--primary)]" },
          { lab: "Juárez", d: tot.jrz, big: "text-[var(--primary)]" },
          { lab: "Total", d: tot.all, big: "" },
        ].map((k) => (
          <div key={k.lab} className="rounded-2xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] p-4">
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">{k.lab}</p>
              <span className="text-xs text-[var(--on-surface-variant)]">{k.d.n} suc.</span>
            </div>
            <p className={`tnum text-2xl font-semibold mt-1 ${k.big}`}>{pesos0(k.d.costo)}</p>
            <div className="flex flex-col gap-0.5 mt-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--primary)" }} />Caducidad</span>
                <span className="tnum">{pesos0(k.d.caducidad)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--error)" }} />Daño</span>
                <span className="tnum">{pesos0(k.d.dano)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tablas por ciudad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TablaCiudad ciudad="Chihuahua" filas={chi} />
        <TablaCiudad ciudad="Juárez" filas={jrz} />
      </div>
    </div>
  );
}
