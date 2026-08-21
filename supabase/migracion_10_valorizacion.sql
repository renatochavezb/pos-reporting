-- Valoriza la merma con los COSTOS de tu lista (por region), vía equivalencias.
create or replace view merma_costeada
with (security_invoker = on) as
select
  m.sucursal, m.no_transaccion, m.tipo, m.fecha, m.fecha_hora, m.folio,
  m.no_insumo, m.insumo, m.categoria, m.cantidad,
  sr.region,
  e.producto_norm, e.tamano,
  p.costo                                    as costo_unit,
  p.precio_venta                             as precio_publico,
  case when p.costo is not null
       then round((m.cantidad * p.costo)::numeric, 2) end as importe_costo
from merma m
left join sucursal_region sr on sr.sucursal = m.sucursal
left join equivalencias  e  on e.insumo_norm = m.insumo_norm
left join precios        p  on p.region = sr.region
                           and p.producto_norm = e.producto_norm
                           and p.tamano = e.tamano;
grant select on merma_costeada to authenticated;

drop view if exists v_merma_diaria;
create view v_merma_diaria with (security_invoker = on) as
select sucursal, fecha, sum(cantidad) as piezas, sum(importe_costo) as pesos,
       count(distinct no_insumo) as productos, count(distinct folio) as sesiones
from merma_costeada group by sucursal, fecha;

drop view if exists v_merma_semanal;
create view v_merma_semanal with (security_invoker = on) as
select sucursal,
       extract(isoyear from fecha)::int as anio,
       extract(week from fecha)::int    as semana,
       date_trunc('week', fecha)::date   as lunes,
       (date_trunc('week', fecha) + interval '6 days')::date as domingo,
       sum(cantidad) as piezas, sum(importe_costo) as pesos,
       count(distinct no_insumo) as productos, count(distinct fecha) as dias_con_captura
from merma_costeada
group by sucursal, extract(isoyear from fecha), extract(week from fecha), date_trunc('week', fecha);

drop view if exists v_merma_por_producto;
create view v_merma_por_producto with (security_invoker = on) as
select sucursal, no_insumo, max(insumo) as insumo, max(categoria) as categoria,
       sum(cantidad) as piezas, sum(importe_costo) as pesos,
       max(costo_unit) as costo_unit, max(precio_publico) as precio_publico,
       bool_or(costo_unit is not null) as tiene_costo,
       count(*) as movimientos
from merma_costeada group by sucursal, no_insumo;

grant select on v_merma_diaria, v_merma_semanal, v_merma_por_producto to authenticated;
