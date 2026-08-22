import { createClient } from "@/libs/supabase/server";
import Sidebar from "@/components/Sidebar";
import ButtonAccount from "@/components/ButtonAccount";
import SubirPrecios from "@/components/SubirPrecios";

export const dynamic = "force-dynamic";

const pesos = (n) =>
  n == null ? "—" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);

export default async function PreciosPage() {
  const supabase = await createClient();
  const [{ data: precios }, { data: ultimaCarga }] = await Promise.all([
    supabase.from("precios").select("*").order("producto"),
    supabase.from("precios_cargas").select("*").order("cargado_en", { ascending: false }).limit(1).maybeSingle(),
  ]);

  // pivot: (producto, tamaño) -> { chihuahua, juarez }
  const mapa = new Map();
  (precios || []).forEach((p) => {
    const k = `${p.producto_norm}|${p.tamano}`;
    if (!mapa.has(k)) mapa.set(k, { producto: p.producto, tamano: p.tamano, CHIHUAHUA: null, JUAREZ: null });
    mapa.get(k)[p.region] = p.costo;
  });
  const filas = [...mapa.values()].sort((a, b) =>
    a.producto === b.producto ? (a.tamano < b.tamano ? 1 : -1) : a.producto < b.producto ? -1 : 1
  );
  const nCh = (precios || []).filter((p) => p.region === "CHIHUAHUA").length;
  const nJz = (precios || []).filter((p) => p.region === "JUAREZ").length;

  return (
    <div className="dn-brand flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-[260px] flex flex-col min-h-screen">
        <div className="px-6 md:px-12 py-8 max-w-[1100px] mx-auto w-full flex flex-col gap-8">
          {/* Encabezado */}
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div>
              <p className="eyebrow">Administración</p>
              <h1 className="font-headline text-4xl md:text-[42px] leading-tight text-[var(--on-surface)] mt-2">Precios</h1>
              <div className="w-12 h-[3px] rounded-full bg-[var(--primary)] mt-3" />
              <p className="text-sm text-[var(--on-surface-variant)] mt-4">
                {nCh} precios Chihuahua · {nJz} precios Juárez
              </p>
            </div>
            <ButtonAccount />
          </div>

          {/* Cargar lista */}
          <SubirPrecios ultimaCarga={ultimaCarga} />

          {/* Tabla de precios por región */}
          <div className="bg-[var(--surface-container-lowest)] rounded-2xl border border-[var(--outline-variant)] overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <p className="eyebrow">Costos por región</p>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-[var(--surface-container-low)] sticky top-0">
                  <tr className="font-label text-[11px] uppercase tracking-wider text-[var(--on-surface-variant)]">
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Tamaño</th>
                    <th className="px-4 py-3 font-medium text-right">Chihuahua</th>
                    <th className="px-4 py-3 font-medium text-right">Juárez</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-[var(--on-surface)]">
                  {filas.map((f, i) => {
                    const iguales = f.CHIHUAHUA != null && f.CHIHUAHUA === f.JUAREZ;
                    return (
                      <tr key={i} className="border-t border-[var(--outline-variant)]/60 hover:bg-[var(--surface-container-low)]/50">
                        <td className="px-4 py-2.5">{f.producto}</td>
                        <td className="px-4 py-2.5 text-[var(--on-surface-variant)]">{f.tamano === "GD" ? "Grande" : "Chico"}</td>
                        <td className="px-4 py-2.5 text-right tnum">{pesos(f.CHIHUAHUA)}</td>
                        <td className={`px-4 py-2.5 text-right tnum ${iguales ? "text-[var(--muted-soft)]" : ""}`}>{pesos(f.JUAREZ)}</td>
                      </tr>
                    );
                  })}
                  {filas.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--on-surface-variant)]">Aún no hay precios cargados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="h-4" />
        </div>
      </main>
    </div>
  );
}
