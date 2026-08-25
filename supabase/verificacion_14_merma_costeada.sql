-- Verificación del Hito 1 (migracion_14_merma_costeada_campos.sql).
-- Esto NO es una migración: no se aplica con aplicar_sql.mjs. Es un archivo de
-- consultas para pegar en el SQL Editor de Supabase, a mano, en tres momentos:
--
--   Momento A — ANTES de aplicar migracion_14: correr la consulta 1 y GUARDAR el
--               resultado (captura de pantalla o copiar los números).
--   Momento B — aplicar migracion_14_merma_costeada_campos.sql.
--   Momento C — DESPUÉS de aplicar: correr la consulta 2 (idéntica a la 1) y
--               comparar contra lo guardado en el Momento A, más las consultas 3-7.
--
-- Si cualquier verificación falla: revertir migracion_14 (create or replace view
-- merma_costeada con la definición de migracion_13_fecha_efectiva.sql, es decir,
-- sin las columnas 19 y 20) y detenerse. No seguir con el hito 2 hasta resolverlo.

-- =====================================================================
-- 1. ANTES de aplicar migracion_14 — totales del tablero de hoy.
--    Un solo union all, ordenado, para poder comparar visualmente contra la
--    consulta 2 sin reordenar filas a mano.
-- =====================================================================
select 'diaria' as vista, count(*), sum(piezas), sum(pesos) from v_merma_diaria
union all
select 'semanal', count(*), sum(piezas), sum(pesos) from v_merma_semanal
union all
select 'por_producto', count(*), sum(piezas), sum(pesos) from v_merma_por_producto
union all
select 'por_tipo', count(*), sum(piezas), sum(pesos) from v_merma_por_tipo
order by 1;

-- =====================================================================
-- 2. DESPUÉS de aplicar migracion_14 — la misma consulta, palabra por palabra.
--    Las cuatro filas deben salir IDÉNTICAS, dígito por dígito, a las de la
--    consulta 1. Cualquier diferencia -- una sola pieza, un solo peso -- significa
--    que algo en las 18 columnas originales se movió: revertir y detenerse.
-- =====================================================================
select 'diaria' as vista, count(*), sum(piezas), sum(pesos) from v_merma_diaria
union all
select 'semanal', count(*), sum(piezas), sum(pesos) from v_merma_semanal
union all
select 'por_producto', count(*), sum(piezas), sum(pesos) from v_merma_por_producto
union all
select 'por_tipo', count(*), sum(piezas), sum(pesos) from v_merma_por_tipo
order by 1;

-- =====================================================================
-- 3. Orden y nombres de columnas de merma_costeada.
--    Esperado: 18 columnas en las mismas posiciones de siempre (sucursal=1 ...
--    importe_costo=18), insumo_norm en la posición 19 y costo_confiable en la 20.
--    Si algo salió en otra posición o con otro nombre, el hito no pasa.
-- =====================================================================
select ordinal_position, column_name, data_type
from information_schema.columns
where table_name = 'merma_costeada'
order by ordinal_position;

-- =====================================================================
-- 4. Grants vivos: authenticated debe seguir teniendo SELECT sobre la vista.
--    Esperado: al menos una fila con grantee='authenticated' y privilege_type='SELECT'.
-- =====================================================================
select grantee, privilege_type
from information_schema.role_table_grants
where table_name = 'merma_costeada';

-- =====================================================================
-- 5. security_invoker vivo. Esperado: reloptions = {security_invoker=on}.
--    Si sale vacío o sin ese valor, la vista quedó security_definer -- falla
--    silenciosa de RLS -- y hay que corregir antes de dar el hito por bueno.
-- =====================================================================
select relname, reloptions
from pg_class
where relname = 'merma_costeada';

-- =====================================================================
-- 6. Las cuatro vistas del tablero siguen existiendo. Esperado: 4.
-- =====================================================================
select count(*)
from pg_views
where viewname in ('v_merma_diaria', 'v_merma_semanal', 'v_merma_por_producto', 'v_merma_por_tipo');

-- =====================================================================
-- 7. Salud de insumo_norm en merma.
--    Esta columna se agregó en migracion_09 y el extractor la escribe desde
--    entonces, pero la ventana incremental solo re-extrae un día de traslape, así
--    que puede haber filas viejas (de julio) sin normalizar. Si el resultado de
--    "nulos" es mayor a 0, anotarlo en la bitácora del hito: el ranking del
--    consolidado (hito 3 en adelante) mostrará esas filas agrupadas bajo el
--    nombre crudo del insumo (por el coalesce a upper(btrim(insumo)) que usan las
--    vistas v_consolidado_*), no perdidas. Se resuelve con una re-extracción del
--    periodo afectado -- eso es un cambio de dato, no de código, y queda fuera de
--    alcance de este módulo.
-- =====================================================================
select
  count(*) filter (where insumo_norm is null) as nulos,
  count(*) as total
from merma;
