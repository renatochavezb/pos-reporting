-- Verificación del Hito 3 (migracion_16_vistas_consolidado.sql).
-- Esto NO es una migración: no se aplica con aplicar_sql.mjs. Es un archivo de consultas para
-- pegar en el SQL Editor de Supabase, después de haber aplicado migracion_14, migracion_15 y
-- migracion_16 en ese orden.
--
-- Este es el archivo que decide si el módulo se gana o se pierde: la prueba maestra es la
-- consulta 2. Si esa consulta devuelve una sola fila, el consolidado está mal y el hito no pasa.

-- =====================================================================
-- 1. Las diez vistas existen, y `authenticated` tiene SELECT en las diez.
--    Esperado: la primera consulta trae 10 filas; la segunda también trae 10 filas, todas
--    con privilege_type = 'SELECT'.
-- =====================================================================
select viewname
from pg_views
where viewname like 'v\_consolidado\_%' escape '\'
order by viewname;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_name like 'v\_consolidado\_%' escape '\'
  and grantee = 'authenticated'
order by table_name;

-- =====================================================================
-- 2. LA PRUEBA MAESTRA — conciliación semanal, todo el histórico.
--    Compara v_consolidado_semanal contra la suma por `lunes` de v_merma_semanal (la vista
--    por sucursal de migracion_13). Se muestran SOLO las filas donde pesos o piezas difieren.
--    ESPERADO: 0 FILAS. Una sola fila significa que el consolidado no cuadra con las
--    sucursales y el hito 3 NO PASA -- hay que revisar la migración, no forzar el resultado.
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
-- 3. Lo mismo, por día, contra v_merma_diaria. ESPERADO: 0 filas.
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
-- 4. El aporte por sucursal suma exactamente el total, semana por semana.
--    ESPERADO: 0 filas.
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
-- 5a. Las regiones suman el total (todo el histórico). ESPERADO: dif_pesos = 0, dif_piezas = 0.
-- =====================================================================
select
  (select sum(pesos)  from v_consolidado_por_region) - (select sum(pesos)  from v_consolidado_diaria) as dif_pesos,
  (select sum(piezas) from v_consolidado_por_region) - (select sum(piezas) from v_consolidado_diaria) as dif_piezas;

-- 5b. Los tipos de motivo suman las piezas del total. ESPERADO: dif_pesos = 0, dif_piezas = 0.
select
  (select sum(pesos)  from v_consolidado_por_tipo) - (select sum(pesos)  from v_consolidado_diaria) as dif_pesos,
  (select sum(piezas) from v_consolidado_por_tipo) - (select sum(piezas) from v_consolidado_diaria) as dif_piezas;

-- =====================================================================
-- 6a. Ranking sin duplicados. Por construcción v_consolidado_por_producto ya agrupa por
--     `llave`, así que esto es una comprobación de sanidad: debe salir vacío siempre.
--     ESPERADO: 0 filas.
-- =====================================================================
select llave, count(*)
from v_consolidado_por_producto
group by llave
having count(*) > 1;

-- 6b. La suma de piezas del ranking es igual a las piezas totales del periodo.
--     ESPERADO: piezas_ranking = piezas_periodo.
select
  (select sum(piezas) from v_consolidado_por_producto) as piezas_ranking,
  (select sum(piezas) from v_consolidado_diaria)        as piezas_periodo;

-- =====================================================================
-- 7. Espejo de regiones. Con los datos de hoy debe salir el par CHIHUAHUA/JUAREZ con
--    es_espejo = true y pct_iguales cercano a 1.
--    Si NO sale así (es_espejo = false, o la fila no aparece), la detección está mal escrita
--    -- este es exactamente el bug documentado en contexto/decisiones.md, "Juárez 3 — NO era
--    el código": la columna de costo de Juárez venía duplicada de la de Chihuahua.
-- =====================================================================
select *
from v_consolidado_regiones_espejo
where (region_a = 'CHIHUAHUA' and region_b = 'JUAREZ')
   or (region_a = 'JUAREZ' and region_b = 'CHIHUAHUA');

-- =====================================================================
-- 8. Cobertura. ESPERADO: 2 filas. nombre_display = 'FUENTES MARES' y 'MISIONES', ambas con
--    en_padron = true y tiene_region = true. costos_provisionales = true SOLO en la fila de
--    MISIONES (region JUAREZ, no es la de referencia); false en FUENTES MARES (CHIHUAHUA, sí
--    es la de referencia).
-- =====================================================================
select
  sucursal, nombre_display, region, estado, orden, en_padron,
  estatus_sync, ultima_corrida, filas_sync, con_datos,
  tiene_region, tiene_precios_en_su_region, costos_provisionales,
  sin_corrida_reciente, nunca_sincronizada
from v_consolidado_cobertura
order by orden nulls last, sucursal;
