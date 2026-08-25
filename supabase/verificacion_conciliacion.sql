-- Prueba maestra de conciliación del módulo dulce-noviembre-consolidado (Hito 7, cierre).
-- Esto NO es una migración: no se aplica con aplicar_sql.mjs. Es un archivo de consultas para
-- pegar en el SQL Editor de Supabase, después de tener aplicadas migracion_14, migracion_15 y
-- migracion_16. Sus resultados son los que se pegan en la bitácora del hito 7
-- (bitacoras/dulce-noviembre-consolidado/hitos/07-conciliacion.md): el módulo no se da por
-- cerrado sin esos números anotados con datos reales.
--
-- Qué prueba: que el consolidado de cadena, en cada uno de sus cortes (diario, semanal, por
-- sucursal, por región, por tipo de motivo, por producto), es exactamente la suma de lo que ya
-- existía por sucursal. Ningún corte inventa ni pierde un peso o una pieza.

-- =====================================================================
-- 1. Conciliación semanal, todo el histórico.
--    full join entre v_consolidado_semanal y la suma por `lunes` de v_merma_semanal (la vista
--    por sucursal). Se muestran SOLO las semanas donde pesos o piezas difieren.
--    ESPERADO: 0 FILAS.
-- =====================================================================
select
  coalesce(c.lunes, s.lunes)  as lunes,
  c.piezas                    as piezas_consolidado,
  s.piezas                    as piezas_suma_sucursales,
  c.pesos                     as pesos_consolidado,
  s.pesos                     as pesos_suma_sucursales
from v_consolidado_semanal c
full join (
  select lunes, sum(piezas) as piezas, sum(pesos) as pesos
  from v_merma_semanal
  group by lunes
) s on s.lunes = c.lunes
where c.piezas is distinct from s.piezas
   or c.pesos  is distinct from s.pesos;

-- =====================================================================
-- 2. Conciliación diaria, todo el histórico, contra v_merma_diaria por `fecha`.
--    ESPERADO: 0 FILAS.
-- =====================================================================
select
  coalesce(c.fecha, s.fecha)  as fecha,
  c.piezas                    as piezas_consolidado,
  s.piezas                    as piezas_suma_sucursales,
  c.pesos                     as pesos_consolidado,
  s.pesos                     as pesos_suma_sucursales
from v_consolidado_diaria c
full join (
  select fecha, sum(piezas) as piezas, sum(pesos) as pesos
  from v_merma_diaria
  group by fecha
) s on s.fecha = c.fecha
where c.piezas is distinct from s.piezas
   or c.pesos  is distinct from s.pesos;

-- =====================================================================
-- 3. El aporte por sucursal (v_consolidado_aporte_semanal) suma exactamente el total de
--    v_consolidado_semanal, semana por semana. ESPERADO: 0 FILAS.
-- =====================================================================
select
  a.lunes,
  sum(a.pesos)  as suma_aporte_pesos,
  max(c.pesos)  as total_cadena_pesos,
  sum(a.piezas) as suma_aporte_piezas,
  max(c.piezas) as total_cadena_piezas
from v_consolidado_aporte_semanal a
join v_consolidado_semanal c on c.lunes = a.lunes
group by a.lunes
having sum(a.pesos)  is distinct from max(c.pesos)
    or sum(a.piezas) is distinct from max(c.piezas);

-- =====================================================================
-- 4. Las regiones suman el total del periodo completo. ESPERADO: dif_pesos = 0.00.
-- =====================================================================
select
  round((select sum(pesos) from v_consolidado_por_region) - (select sum(pesos) from v_consolidado_diaria), 2) as dif_pesos,
  (select sum(piezas) from v_consolidado_por_region) - (select sum(piezas) from v_consolidado_diaria)         as dif_piezas;

-- =====================================================================
-- 5. Los tipos de motivo suman las piezas del periodo completo. ESPERADO: dif_piezas = 0.
-- =====================================================================
select
  (select sum(piezas) from v_consolidado_por_tipo) - (select sum(piezas) from v_consolidado_diaria) as dif_piezas;

-- =====================================================================
-- 6a. Ranking sin duplicados: v_consolidado_por_producto ya agrupa por `llave`, así que esto
--     es una comprobación de sanidad, debe salir siempre vacío. ESPERADO: 0 FILAS.
-- =====================================================================
select llave, count(*)
from v_consolidado_por_producto
group by llave
having count(*) > 1;

-- 6b. La suma de piezas del ranking es igual a las piezas totales del periodo.
--     ESPERADO: piezas_ranking = piezas_periodo (misma cifra en las dos columnas).
select
  (select sum(piezas) from v_consolidado_por_producto) as piezas_ranking,
  (select sum(piezas) from v_consolidado_diaria)        as piezas_periodo;

-- =====================================================================
-- 7. EL NÚMERO CONCRETO DE LA SEMANA EN CURSO — esta es la que se pega en la bitácora.
--    Total del consolidado de la semana en curso vs. la suma de cada sucursal por separado,
--    con la diferencia ya calculada. ESPERADO: diferencia = 0.00 (pesos) y 0 (piezas).
-- =====================================================================
with semana_actual as (
  select date_trunc('week', now())::date as lunes
)
select
  c.pesos                                                          as consolidado_pesos,
  c.piezas                                                         as consolidado_piezas,
  sum(a.pesos)  filter (where a.sucursal = 'FUENTES MARES')        as fuentes_mares_pesos,
  sum(a.pesos)  filter (where a.sucursal = 'JUAREZ 3')             as misiones_pesos,
  sum(a.piezas) filter (where a.sucursal = 'FUENTES MARES')        as fuentes_mares_piezas,
  sum(a.piezas) filter (where a.sucursal = 'JUAREZ 3')             as misiones_piezas,
  round(
    c.pesos - coalesce(sum(a.pesos) filter (where a.sucursal in ('FUENTES MARES', 'JUAREZ 3')), 0)
  , 2)                                                              as diferencia_pesos,
  c.piezas - coalesce(sum(a.piezas) filter (where a.sucursal in ('FUENTES MARES', 'JUAREZ 3')), 0)
                                                                     as diferencia_piezas
from semana_actual sa
left join v_consolidado_semanal c on c.lunes = sa.lunes
left join v_consolidado_aporte_semanal a on a.lunes = sa.lunes
group by c.pesos, c.piezas;

-- =====================================================================
-- 8. Base comparable — las filas de v_consolidado_aporte_semanal de la semana actual y la
--    previa, una junto a otra, para confirmar a mano si el conjunto de sucursales que
--    aportaron cambió entre las dos semanas y si la píldora de variación del tablero (hito 6)
--    dice lo correcto ("misma base: N sucursales" o "base comparable: N sucursales, excluye…").
-- =====================================================================
with semanas as (
  select date_trunc('week', now())::date                    as actual,
         date_trunc('week', now())::date - interval '7 days' as previa
)
select
  a.sucursal,
  a.lunes,
  case when a.lunes = s.actual then 'actual' else 'previa' end as cual,
  a.piezas,
  a.pesos
from v_consolidado_aporte_semanal a
join semanas s on a.lunes in (s.actual, s.previa)
order by a.sucursal, a.lunes;
