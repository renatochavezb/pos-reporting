import { createClient } from "@/libs/supabase/server";
import Sidebar from "@/components/Sidebar";
import ButtonAccount from "@/components/ButtonAccount";
import SubirPrecios from "@/components/SubirPrecios";
import TablaPrecios from "@/components/TablaPrecios";

export const dynamic = "force-dynamic";

export default async function PreciosPage() {
  const supabase = await createClient();
  const [{ data: precios }, { data: ultimaCarga }] = await Promise.all([
    supabase.from("precios").select("*").order("producto"),
    supabase.from("precios_cargas").select("*").order("cargado_en", { ascending: false }).limit(1).maybeSingle(),
  ]);

  // pivot: (producto, tamaño) -> { CHIHUAHUA:{costo,publico}, JUAREZ:{costo,publico} }
  const mapa = new Map();
  (precios || []).forEach((p) => {
    const k = `${p.producto_norm}|${p.tamano}`;
    if (!mapa.has(k))
      mapa.set(k, { producto: p.producto, tamano: p.tamano, CHIHUAHUA: { costo: null, publico: null }, JUAREZ: { costo: null, publico: null } });
    mapa.get(k)[p.region] = { costo: p.costo, publico: p.precio_venta };
  });
  const filas = [...mapa.values()].sort((a, b) =>
    a.producto === b.producto ? (a.tamano < b.tamano ? 1 : -1) : a.producto < b.producto ? -1 : 1
  );
  const resumen = {
    nCh: (precios || []).filter((p) => p.region === "CHIHUAHUA").length,
    nJz: (precios || []).filter((p) => p.region === "JUAREZ").length,
    chPub: (precios || []).filter((p) => p.region === "CHIHUAHUA" && p.precio_venta > 0).length,
    jzPub: (precios || []).filter((p) => p.region === "JUAREZ" && p.precio_venta > 0).length,
  };
  const { nCh, nJz } = resumen;

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

          {/* Tabla de precios por región (Costos / Precio público) */}
          <TablaPrecios filas={filas} resumen={resumen} />
          <div className="h-4" />
        </div>
      </main>
    </div>
  );
}
