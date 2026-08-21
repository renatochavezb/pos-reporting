-- Merma por semana ISO (lunes a domingo), identificada por numero de semana.
drop view if exists v_merma_semanal;
create view v_merma_semanal
with (security_invoker = on) as
select
  sucursal,
  extract(isoyear from fecha)::int              as anio,
  extract(week from fecha)::int                 as semana,          -- numero de semana ISO
  date_trunc('week', fecha)::date               as lunes,          -- inicio (lunes)
  (date_trunc('week', fecha) + interval '6 days')::date as domingo, -- fin (domingo)
  sum(cantidad)                                 as piezas,
  sum(importe) filter (where costo_confiable)   as pesos,
  count(distinct no_insumo)                     as productos,
  count(distinct fecha)                         as dias_con_captura
from merma
group by sucursal,
         extract(isoyear from fecha),
         extract(week from fecha),
         date_trunc('week', fecha);

grant select on v_merma_semanal to authenticated;
