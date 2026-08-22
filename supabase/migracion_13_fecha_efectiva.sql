-- La merma se agrupa por la FECHA DEL COMENTARIO (fecha_merma) si viene;
-- si no, por la fecha de captura. Y se clasifica por tipo (caducidad/daño).
drop view if exists v_merma_diaria;
drop view if exists v_merma_semanal;
drop view if exists v_merma_por_producto;
drop view if exists v_merma_por_tipo;
drop view if exists merma_costeada;

create view merma_costeada with (security_invoker = on) as
select
  m.sucursal, m.no_transaccion, m.tipo,
  coalesce(m.fecha_merma, m.fecha)  as fecha,          -- fecha efectiva
  m.fecha                            as fecha_captura,
  m.motivo, m.motivo_tipo,
  m.folio, m.no_insumo, m.insumo, m.categoria, m.cantidad,
  sr.region, e.producto_norm, e.tamano,
  p.costo        as costo_unit,
  p.precio_venta as precio_publico,
  case when p.costo is not null then round((m.cantidad * p.costo)::numeric, 2) end as importe_costo
from merma m
left join sucursal_region sr on sr.sucursal = m.sucursal
left join equivalencias  e  on e.insumo_norm = m.insumo_norm
left join precios        p  on p.region = sr.region and p.producto_norm = e.producto_norm and p.tamano = e.tamano;
grant select on merma_costeada to authenticated;

create view v_merma_diaria with (security_invoker = on) as
select sucursal, fecha, sum(cantidad) as piezas, sum(importe_costo) as pesos,
       count(distinct no_insumo) as productos, count(distinct folio) as sesiones
from merma_costeada group by sucursal, fecha;

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

create view v_merma_por_producto with (security_invoker = on) as
select sucursal, no_insumo, max(insumo) as insumo, max(categoria) as categoria,
       sum(cantidad) as piezas, sum(importe_costo) as pesos,
       max(costo_unit) as costo_unit, max(precio_publico) as precio_publico,
       bool_or(costo_unit is not null) as tiene_costo, count(*) as movimientos
from merma_costeada group by sucursal, no_insumo;

create view v_merma_por_tipo with (security_invoker = on) as
select sucursal, coalesce(motivo_tipo, 'sin clasificar') as tipo,
       sum(cantidad) as piezas, sum(importe_costo) as pesos
from merma_costeada group by sucursal, coalesce(motivo_tipo, 'sin clasificar');

grant select on v_merma_diaria, v_merma_semanal, v_merma_por_producto, v_merma_por_tipo to authenticated;
