-- Las diez vistas del consolidado de cadena. Puramente aditiva: no toca `merma_costeada`,
-- `sucursales`, `regiones`, `configuracion` ni ninguna vista `v_merma_*` existente. De este
-- archivo depende que el total de "toda la cadena" cuadre, al centavo, con la suma de las
-- vistas por sucursal (migracion_13_fecha_efectiva.sql) -- ese es el criterio de éxito del
-- módulo, verificado en supabase/verificacion_16_consolidado.sql.
--
-- Reglas de oro que este archivo respeta (no romperlas si se vuelve a tocar):
--   1. Nueve de las diez vistas leen `merma_costeada` como única fuente de filas de merma y
--      NO llevan filtro propio de `tipo`, de `costo_confiable` ni de fecha: el neteo 18/19, la
--      exclusión de 29/30, la fecha efectiva y el umbral de costo se heredan intactos de
--      `merma_costeada`. Agregar un filtro aquí descuadra el consolidado contra las vistas por
--      sucursal. (Excepción intencional y documentada: v_consolidado_insumos_hueco y
--      v_consolidado_costo_sospechoso SÍ filtran -- por diseño, esa es su función: mostrar
--      exactamente las filas sin costo o con costo sospechoso, no reconciliar totales.)
--   2. Ninguna vista contiene un nombre de sucursal escrito a mano.
--   3. `nombre_display` (en v_consolidado_cobertura) jamás entra a un group by, a un join ... on
--      ni a un where. Solo sale como columna del select externo.
--   4. `sesiones` = count(distinct (sucursal, folio)), nunca count(distinct folio) a secas:
--      folio es único por sucursal, no por cadena.
--   5. `dias_con_captura` = count(distinct fecha). `dias_sucursal` = count(distinct (sucursal,
--      fecha)). Son métricas distintas.
--   6. `piezas_sin_valorizar` = sum(cantidad) filter (where importe_costo is null).
--   7. La llave del ranking de insumos es
--      coalesce(nullif(btrim(insumo_norm), ''), upper(btrim(insumo))), con una columna
--      `normalizado` aparte. Ver RIESGO C del plan: hay filas con insumo_norm nulo.
--   8. `costos_distintos` = count(distinct costo_unit): >1 dispara "varía por región" en la UI.
--   9. v_consolidado_cobertura arma el padrón con un FULL OUTER JOIN entre `sucursales` y
--      `(select distinct sucursal from merma)`, nunca desde `sync_estado` (que puede traer
--      alias colados por el extractor en su rama de error). `sync_estado` entra solo por
--      LEFT JOIN, para traer estatus y última corrida.
--
-- Nota de diseño no trivial (documentada también en contexto/decisiones.md): las columnas
-- `costos_provisionales` de v_consolidado_por_region y de v_consolidado_cobertura necesitan
-- saber si la región es la "provisional" del espejo de costos detectado en `precios`. Para eso
-- ambas hacen un EXISTS de solo lectura contra `regiones` y contra v_consolidado_regiones_espejo
-- (que a su vez lee `precios`). Ese EXISTS no agrega ningún filtro sobre las filas de
-- `merma_costeada` ni cambia su grano: es una bandera descriptiva, igual en espíritu a como
-- v_consolidado_cobertura ya lee `precios` para `tiene_precios_en_su_region`. Sin ese lookup la
-- columna `costos_provisionales` no se podría calcular en absoluto.
--
-- Orden de creación: por dependencia, no por el número de la lista de las diez vistas.
-- v_consolidado_regiones_espejo (vista 10 de la lista) se crea primero porque
-- v_consolidado_por_region (6) y v_consolidado_cobertura (7) la consultan.

drop view if exists v_consolidado_cobertura;
drop view if exists v_consolidado_por_region;
drop view if exists v_consolidado_diaria;
drop view if exists v_consolidado_semanal;
drop view if exists v_consolidado_aporte_semanal;
drop view if exists v_consolidado_por_producto;
drop view if exists v_consolidado_por_tipo;
drop view if exists v_consolidado_insumos_hueco;
drop view if exists v_consolidado_costo_sospechoso;
drop view if exists v_consolidado_regiones_espejo;

-- ============================================================================
-- Vista 10 (creada primero, por dependencia): v_consolidado_regiones_espejo
-- Self-join de `precios`: mismo producto_norm y tamano, distinta región, ambos costos
-- no nulos. Simétrica, sin nombres de región cableados. Igualdad ESTRICTA entre costos,
-- igual que web/app/(private)/(user)/precios/page.js. `a.region < b.region` evita duplicar el
-- par (CHIHUAHUA, JUAREZ) y (JUAREZ, CHIHUAHUA) como dos filas.
-- Los dos umbrales (`espejo_min_productos`, `espejo_umbral_pct`) se leen de `configuracion`,
-- nunca cableados en el SQL.
-- La atribución de cuál región es la provisional NO vive aquí: sale de `regiones.es_referencia`
-- en quien consuma esta vista (v_consolidado_por_region, v_consolidado_cobertura), porque la
-- detección es simétrica pero la atribución no puede serlo.
-- ============================================================================
create view v_consolidado_regiones_espejo with (security_invoker = on) as
with pares as (
  select
    a.region                                    as region_a,
    b.region                                    as region_b,
    count(*)                                    as productos_comparados,
    count(*) filter (where a.costo = b.costo)   as productos_iguales
  from precios a
  join precios b
    on a.producto_norm = b.producto_norm
   and a.tamano = b.tamano
   and a.region < b.region
  where a.costo is not null
    and b.costo is not null
  group by a.region, b.region
)
select
  p.region_a,
  p.region_b,
  p.productos_comparados,
  p.productos_iguales,
  round(p.productos_iguales::numeric / nullif(p.productos_comparados, 0), 4) as pct_iguales,
  (
    p.productos_comparados >= (select valor::int from configuracion where clave = 'espejo_min_productos')
    and
    p.productos_iguales::numeric / nullif(p.productos_comparados, 0)
      >= (select valor::numeric from configuracion where clave = 'espejo_umbral_pct')
  ) as es_espejo
from pares p;

-- ============================================================================
-- Vista 1: v_consolidado_diaria — por fecha, toda la cadena.
-- ============================================================================
create view v_consolidado_diaria with (security_invoker = on) as
select
  fecha,
  sum(cantidad)                                        as piezas,
  sum(importe_costo)                                   as pesos,
  count(distinct no_insumo)                            as productos,
  count(distinct (sucursal, folio))                    as sesiones,
  count(distinct sucursal)                             as sucursales_aportantes,
  sum(cantidad) filter (where importe_costo is null)   as piezas_sin_valorizar
from merma_costeada
group by fecha;

-- ============================================================================
-- Vista 2: v_consolidado_semanal — por semana ISO, toda la cadena.
-- dias_con_captura = días en que capturó AL MENOS UNA sucursal (no es aditivo entre
-- sucursales). dias_sucursal = pares (sucursal, fecha) distintos; sí es aditivo.
-- ============================================================================
create view v_consolidado_semanal with (security_invoker = on) as
select
  extract(isoyear from fecha)::int                      as anio,
  extract(week from fecha)::int                         as semana,
  date_trunc('week', fecha)::date                       as lunes,
  (date_trunc('week', fecha) + interval '6 days')::date as domingo,
  sum(cantidad)                                         as piezas,
  sum(importe_costo)                                    as pesos,
  count(distinct no_insumo)                             as productos,
  count(distinct fecha)                                 as dias_con_captura,
  count(distinct sucursal)                              as sucursales_aportantes,
  count(distinct (sucursal, fecha))                     as dias_sucursal,
  sum(cantidad) filter (where importe_costo is null)    as piezas_sin_valorizar
from merma_costeada
group by extract(isoyear from fecha), extract(week from fecha), date_trunc('week', fecha);

-- ============================================================================
-- Vista 3: v_consolidado_aporte_semanal — grano sucursal × semana.
-- Es la vista que prueba, sucursal por sucursal, que la suma del aporte cuadra con el
-- total de v_consolidado_semanal.
-- ============================================================================
create view v_consolidado_aporte_semanal with (security_invoker = on) as
select
  sucursal,
  extract(isoyear from fecha)::int                      as anio,
  extract(week from fecha)::int                         as semana,
  date_trunc('week', fecha)::date                       as lunes,
  (date_trunc('week', fecha) + interval '6 days')::date as domingo,
  sum(cantidad)                                         as piezas,
  sum(importe_costo)                                    as pesos,
  sum(cantidad) filter (where importe_costo is null)    as piezas_sin_valorizar
from merma_costeada
group by sucursal, extract(isoyear from fecha), extract(week from fecha), date_trunc('week', fecha);

-- ============================================================================
-- Vista 4: v_consolidado_por_producto — ranking de insumos, toda la cadena.
-- `llave` usa coalesce a upper(btrim(insumo)) porque insumo_norm puede venir nulo en filas
-- viejas (RIESGO C del plan): sin el coalesce, esas filas colapsarían en un solo renglón nulo
-- gigante. `normalizado` es true solo si TODAS las filas que componen el grupo trajeron
-- insumo_norm real; false si alguna fila cayó al respaldo crudo -- es la señal de "este renglón
-- del ranking no viene enteramente de datos normalizados".
-- `costos_distintos` > 1 significa que el mismo insumo cuesta distinto según la región (cada
-- llave mapea a un único (producto_norm, tamano) porque `equivalencias` tiene PK insumo_norm).
-- ============================================================================
create view v_consolidado_por_producto with (security_invoker = on) as
select
  coalesce(nullif(btrim(insumo_norm), ''), upper(btrim(insumo)))  as llave,
  max(insumo)                                                     as insumo,
  max(categoria)                                                  as categoria,
  sum(cantidad)                                                   as piezas,
  sum(importe_costo)                                              as pesos,
  bool_or(costo_unit is not null)                                 as tiene_costo,
  max(costo_unit)                                                 as costo_unit,
  count(distinct costo_unit)                                      as costos_distintos,
  count(distinct sucursal)                                        as sucursales,
  count(*)                                                        as movimientos,
  bool_and(nullif(btrim(insumo_norm), '') is not null)            as normalizado
from merma_costeada
group by coalesce(nullif(btrim(insumo_norm), ''), upper(btrim(insumo)));

-- ============================================================================
-- Vista 5: v_consolidado_por_tipo — por tipo de motivo (caducidad/daño/cortesía/otro),
-- toda la cadena. Incluye "sin clasificar" para los comentarios sin clasificar todavía.
-- ============================================================================
create view v_consolidado_por_tipo with (security_invoker = on) as
select
  coalesce(motivo_tipo, 'sin clasificar')  as tipo,
  sum(cantidad)                            as piezas,
  sum(importe_costo)                       as pesos
from merma_costeada
group by coalesce(motivo_tipo, 'sin clasificar');

-- ============================================================================
-- Vista 6: v_consolidado_por_region — por región, incluida la nula (sucursales sin región
-- asignada en sucursal_region).
-- `costos_provisionales`: ver nota de diseño al inicio del archivo. true solo cuando (a) la
-- región NO es la de referencia según `regiones.es_referencia`, y (b) existe un par en
-- v_consolidado_regiones_espejo que incluye esta región con es_espejo = true.
-- ============================================================================
create view v_consolidado_por_region with (security_invoker = on) as
select
  mc.region,
  count(distinct mc.sucursal)                                       as n_sucursales,
  sum(mc.cantidad)                                                  as piezas,
  sum(mc.importe_costo)                                             as pesos,
  sum(mc.cantidad) filter (where mc.importe_costo is null)          as piezas_sin_valorizar,
  coalesce(
    r.es_referencia = false
    and exists (
      select 1
      from v_consolidado_regiones_espejo e
      where e.es_espejo
        and (e.region_a = mc.region or e.region_b = mc.region)
    ),
    false
  ) as costos_provisionales
from merma_costeada mc
left join regiones r on r.region = mc.region
group by mc.region, r.es_referencia;

-- ============================================================================
-- Vista 7: v_consolidado_cobertura — una fila por sucursal del padrón UNIDO con las
-- sucursales que ya tienen datos en `merma`, aunque no estén todavía en el catálogo.
-- FULL OUTER JOIN entre `sucursales` y `(select distinct sucursal from merma)`, NUNCA desde
-- `sync_estado` (el extractor escribe ahí sucursal || alias en su rama de error, y colaría
-- alias como si fueran sucursales). `sync_estado` entra solo por LEFT JOIN.
-- Si una sucursal manda datos antes de estar dada de alta en el catálogo, sale con
-- en_padron = false y nombre_display = sucursal (su propio nombre canónico) como respaldo --
-- necesario para que sus pesos, que ya entraron al total, también aparezcan en cobertura.
-- `nombre_display` sale SOLO como columna de este select externo: no participa en ningún
-- group by, join ... on ni where de esta vista.
-- `sin_corrida_reciente` lee el umbral de horas de `configuracion` (no lo cablea a 36).
-- ============================================================================
create view v_consolidado_cobertura with (security_invoker = on) as
with datos as (
  select distinct sucursal from merma
),
base as (
  select
    coalesce(s.sucursal, d.sucursal)  as sucursal,
    s.nombre_display,
    s.region,
    s.estado,
    s.orden,
    (s.sucursal is not null)          as en_padron,
    (d.sucursal is not null)          as con_datos
  from sucursales s
  full outer join datos d on d.sucursal = s.sucursal
)
select
  b.sucursal,
  coalesce(b.nombre_display, b.sucursal)                          as nombre_display,
  b.region,
  b.estado,
  b.orden,
  b.en_padron,
  se.estatus                                                      as estatus_sync,
  se.ultima_corrida,
  se.filas                                                        as filas_sync,
  b.con_datos,
  (b.region is not null)                                          as tiene_region,
  exists (select 1 from precios p where p.region = b.region)      as tiene_precios_en_su_region,
  coalesce(
    r.es_referencia = false
    and exists (
      select 1
      from v_consolidado_regiones_espejo e
      where e.es_espejo
        and (e.region_a = b.region or e.region_b = b.region)
    ),
    false
  )                                                                as costos_provisionales,
  coalesce(
    se.estatus = 'ok'
    and se.ultima_corrida < now() - (
      (select valor from configuracion where clave = 'horas_sin_corrida_alerta') || ' hours'
    )::interval,
    false
  )                                                                as sin_corrida_reciente,
  (se.sucursal is null)                                           as nunca_sincronizada
from base b
left join sync_estado se on se.sucursal = b.sucursal and se.tabla = 'merma'
left join regiones r on r.region = b.region
order by b.orden nulls last, b.sucursal;

-- ============================================================================
-- Vista 8: v_consolidado_insumos_hueco — insumos sin costo, por causa. A diferencia de las
-- vistas 1-6, ESTA SÍ FILTRA (where importe_costo is null): es su función, no rompe ninguna
-- reconciliación porque es una vista de diagnóstico, no de totales.
-- causa: 'sin región' (la sucursal no tiene región asignada), 'sin equivalencia' (el insumo no
-- tiene fila en `equivalencias` o no mapea a un producto), 'sin precio en su región' (mapea a
-- un producto pero esa región no tiene precio cargado para él).
-- ============================================================================
create view v_consolidado_insumos_hueco with (security_invoker = on) as
select
  case
    when region is null then 'sin región'
    when producto_norm is null then 'sin equivalencia'
    else 'sin precio en su región'
  end                                                            as causa,
  coalesce(nullif(btrim(insumo_norm), ''), upper(btrim(insumo))) as llave,
  max(insumo)                                                    as insumo,
  sum(cantidad)                                                  as piezas,
  array_agg(distinct sucursal order by sucursal)                 as sucursales
from merma_costeada
where importe_costo is null
group by
  case
    when region is null then 'sin región'
    when producto_norm is null then 'sin equivalencia'
    else 'sin precio en su región'
  end,
  coalesce(nullif(btrim(insumo_norm), ''), upper(btrim(insumo)));

-- ============================================================================
-- Vista 9: v_consolidado_costo_sospechoso — insumos marcados costo_confiable = false
-- (captura mal hecha en el POS, no un problema de la cadena de valorización). Igual que la
-- vista anterior, ESTA SÍ FILTRA a propósito: es su función.
-- ============================================================================
create view v_consolidado_costo_sospechoso with (security_invoker = on) as
select
  coalesce(nullif(btrim(insumo_norm), ''), upper(btrim(insumo))) as llave,
  max(insumo)                                                    as insumo,
  sum(cantidad)                                                  as piezas,
  array_agg(distinct sucursal order by sucursal)                 as sucursales
from merma_costeada
where costo_confiable = false
group by coalesce(nullif(btrim(insumo_norm), ''), upper(btrim(insumo)));

grant select on
  v_consolidado_diaria,
  v_consolidado_semanal,
  v_consolidado_aporte_semanal,
  v_consolidado_por_producto,
  v_consolidado_por_tipo,
  v_consolidado_por_region,
  v_consolidado_cobertura,
  v_consolidado_insumos_hueco,
  v_consolidado_costo_sospechoso,
  v_consolidado_regiones_espejo
to authenticated;

notify pgrst, 'reload schema';
