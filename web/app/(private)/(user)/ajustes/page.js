import { createClient } from "@/libs/supabase/server";
import Sidebar from "@/components/Sidebar";
import ButtonAccount from "@/components/ButtonAccount";
import Autorizaciones from "@/components/Autorizaciones";

export const dynamic = "force-dynamic";

const MXN_POR_USD = 20; // aproximado, solo referencia
const usd = (n) => "$" + (Number(n || 0)).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
const usd2 = (n) => "$" + (Number(n || 0)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mxn = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(n || 0) * MXN_POR_USD);
const fechaHora = (iso) =>
  !iso ? "—" : new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
const titulo = (s) => String(s || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default async function AjustesPage() {
  const supabase = await createClient();
  const { data: usos } = await supabase.from("ia_uso").select("*").order("creado_en", { ascending: false }).limit(50);
  const lista = usos || [];

  const totalUsd = lista.reduce((a, x) => a + Number(x.costo_usd || 0), 0);
  const ym = new Date().toISOString().slice(0, 7);
  const mesUsd = lista.filter((x) => String(x.creado_en || "").slice(0, 7) === ym).reduce((a, x) => a + Number(x.costo_usd || 0), 0);
  const modelo = process.env.BITACORA_MODEL || "claude-sonnet-5";

  return (
    <div className="dn-brand flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-[260px] flex flex-col min-h-screen">
        <div className="px-6 md:px-12 py-8 max-w-[1000px] mx-auto w-full flex flex-col gap-8">
          {/* Encabezado */}
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div>
              <p className="eyebrow">Administración</p>
              <h1 className="font-headline text-4xl md:text-[42px] leading-tight text-[var(--on-surface)] mt-2">Ajustes</h1>
              <div className="w-12 h-[3px] rounded-full bg-[var(--primary)] mt-3" />
            </div>
            <ButtonAccount />
          </div>

          {/* Costos de uso */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 rounded-full bg-[var(--primary)]" />
              <h2 className="font-headline text-2xl text-[var(--on-surface)]">Costos de uso</h2>
              <span className="ml-2 text-xs text-[var(--on-surface-variant)]">IA · procesamiento de bitácoras</span>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-2xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] p-4">
                <p className="eyebrow">Gasto total</p>
                <p className="tnum text-2xl font-semibold text-[var(--primary)] mt-1">{usd2(totalUsd)}</p>
                <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">≈ {mxn(totalUsd)}</p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] p-4">
                <p className="eyebrow">Este mes</p>
                <p className="tnum text-2xl font-semibold mt-1">{usd2(mesUsd)}</p>
                <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">≈ {mxn(mesUsd)}</p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] p-4">
                <p className="eyebrow">Procesamientos</p>
                <p className="tnum text-2xl font-semibold mt-1">{lista.length}</p>
                <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">fotos procesadas</p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] p-4">
                <p className="eyebrow">Modelo</p>
                <p className="text-sm font-semibold mt-1 break-all">{modelo}</p>
                <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">motor de transcripción</p>
              </div>
            </div>

            {/* Historial */}
            <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] overflow-hidden">
              <div className="px-5 pt-5 pb-3"><p className="eyebrow">Últimos procesamientos</p></div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-[var(--surface-container-low)] sticky top-0">
                    <tr className="font-label text-[10px] uppercase tracking-wider text-[var(--on-surface-variant)]">
                      <th className="px-4 py-3 font-medium">Fecha</th>
                      <th className="px-4 py-3 font-medium">Sucursal</th>
                      <th className="px-4 py-3 font-medium">Modelo</th>
                      <th className="px-4 py-3 font-medium text-right">Tokens (in/out)</th>
                      <th className="px-4 py-3 font-medium text-right">Costo</th>
                    </tr>
                  </thead>
                  <tbody className="text-[var(--on-surface)]">
                    {lista.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--on-surface-variant)]">Aún no se ha procesado ninguna bitácora con IA</td></tr>
                    ) : (
                      lista.map((u) => (
                        <tr key={u.id} className="border-t border-[var(--outline-variant)]/60">
                          <td className="px-4 py-2.5 text-[var(--on-surface-variant)]">{fechaHora(u.creado_en)}</td>
                          <td className="px-4 py-2.5">{titulo(u.sucursal)}</td>
                          <td className="px-4 py-2.5 text-[var(--on-surface-variant)]">{u.modelo}</td>
                          <td className="px-4 py-2.5 text-right tnum text-[var(--on-surface-variant)]">{(u.input_tokens || 0).toLocaleString()} / {(u.output_tokens || 0).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right tnum font-semibold">{usd(u.costo_usd)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-[var(--on-surface-variant)]">
              Costos en USD (así cobra la API). El equivalente en pesos es <b>aproximado</b> (≈ ${MXN_POR_USD}/USD). Puedes cambiar el modelo con <code>BITACORA_MODEL</code> en <code>web/.env.local</code>.
            </p>
          </section>

          <div className="h-px bg-[var(--outline-variant)]" />

          {/* Autorizaciones */}
          <Autorizaciones />
        </div>
      </main>
    </div>
  );
}
