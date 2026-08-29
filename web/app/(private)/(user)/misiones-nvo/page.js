import { createClient } from "@/libs/supabase/server";
import Sidebar from "@/components/Sidebar";
import ButtonAccount from "@/components/ButtonAccount";
import BotonActualizar from "@/components/BotonActualizar";
import MermaNvo from "@/components/MermaNvo";

export const dynamic = "force-dynamic";

export default async function MisionesNvoPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("merma_costeada")
    .select("fecha,insumo,cantidad,motivo_tipo,costo_unit,precio_publico,importe_costo")
    .eq("sucursal", "MISIONES");

  return (
    <div className="dn-brand flex min-h-screen">
      <Sidebar />

      <main className="flex-1 md:ml-[260px] flex flex-col min-h-screen">
        <div className="px-6 md:px-12 py-8 max-w-[1280px] mx-auto w-full flex flex-col gap-8">
          {/* Encabezado */}
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div>
              <p className="eyebrow">Vista nueva · prototipo</p>
              <h1 className="font-headline text-4xl md:text-[42px] leading-tight text-[var(--on-surface)] mt-2">
                Merma <span className="text-[var(--on-surface-variant)]">— Misiones</span>
              </h1>
              <div className="w-12 h-[3px] rounded-full bg-[var(--primary)] mt-3" />
              <div className="flex items-center gap-2 mt-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] border border-[var(--outline-variant)] text-[var(--on-surface-variant)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" /> Zona Juárez
                </span>
                <span className="text-sm text-[var(--on-surface-variant)]">
                  Por semana → día, clasificada en caducidad / daño (fecha real del comentario)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <BotonActualizar sucursal="MISIONES" />
              <ButtonAccount />
            </div>
          </div>

          <MermaNvo rows={rows || []} />

          <p className="text-xs text-[var(--on-surface-variant)] border-t border-[var(--outline-variant)] pt-4">
            Prototipo del nuevo acomodo (solo Misiones). La columna <b>Público</b> se llena al cargar la lista con
            precio de menú. El costo usado es el vigente al momento; los cambios de precio aplican de ahí en adelante.
          </p>
        </div>
      </main>
    </div>
  );
}
