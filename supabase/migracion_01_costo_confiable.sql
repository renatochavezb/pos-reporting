-- Migracion 01: marcar costos no confiables (error de captura tipo macarron)
-- y valorizar solo lo confiable en las vistas.

alter table merma add column if not exists costo_confiable boolean not null default true;

-- se recrean las vistas (drop + create) porque cambian columnas
drop view if exists v_merma_diaria;
drop view if exists v_merma_por_producto;
drop view if exists v_merma_por_motivo;
drop view if exists v_merma_costo_sospechoso;

-- pesos = solo costos confiables; piezas = siempre (el conteo es correcto)
create view v_merma_diaria as
select sucursal,
       fecha,
       sum(cantidad)                                as piezas,
       sum(importe) filter (where costo_confiable)  as pesos,
       count(distinct no_insumo)                    as productos,
       count(distinct folio)                        as sesiones
from merma
group by sucursal, fecha;

create view v_merma_por_producto as
select sucursal,
       no_insumo,
       max(insumo)                                  as insumo,
       max(categoria)                               as categoria,
       sum(cantidad)                                as piezas,
       sum(importe) filter (where costo_confiable)  as pesos,
       bool_and(costo_confiable)                    as costo_ok,
       count(*)                                     as movimientos
from merma
group by sucursal, no_insumo;

create view v_merma_por_motivo as
select sucursal,
       coalesce(nullif(btrim(motivo), ''), '(sin motivo capturado)') as motivo,
       sum(cantidad)                                as piezas,
       sum(importe) filter (where costo_confiable)  as pesos
from merma
group by sucursal, coalesce(nullif(btrim(motivo), ''), '(sin motivo capturado)');

-- productos con costo mal capturado (para corregir en el POS)
create view v_merma_costo_sospechoso as
select sucursal, no_insumo, max(insumo) as insumo,
       max(costo_unitario) as costo_capturado,
       sum(cantidad) as piezas_mermadas
from merma
where costo_confiable = false
group by sucursal, no_insumo;
