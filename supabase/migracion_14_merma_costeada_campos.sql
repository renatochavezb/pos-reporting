-- Expone insumo_norm y costo_confiable en merma_costeada, para que el consolidado
-- de cadena (hitos 2-7) pueda agrupar por llave normalizada y saber qué costos son
-- confiables, sin depender de merma directamente.
--
-- Por qué es "create or replace" y no "drop" + "create":
-- de merma_costeada cuelgan v_merma_diaria, v_merma_semanal, v_merma_por_producto y
-- v_merma_por_tipo, es decir, TODO el tablero que hoy funciona en producción. Un
-- "drop view merma_costeada cascade" tumbaría esas cuatro vistas de un golpe. Un
-- "drop" sin cascade fallaría por dependencias. "create or replace" evita ambos
-- problemas: conserva los grants existentes y no toca a los dependientes mientras
-- la firma de columnas (nombres, tipos, orden de las que ya existían) no cambie.
--
-- Reglas que este archivo respeta y que NO se deben romper si se vuelve a tocar
-- este objeto en el futuro:
--   1. JAMÁS "drop view merma_costeada" ni "drop ... cascade".
--   2. Las primeras 18 columnas son EXACTAMENTE las de migracion_13_fecha_efectiva.sql
--      (mismo nombre, mismo tipo, mismo orden). Se copiaron de ese archivo, no se
--      reescribieron de memoria. Ojo: migracion_13 quitó fecha_hora respecto de
--      migracion_10; la definición vigente es la de la 13, sin fecha_hora.
--   3. Las columnas nuevas van SIEMPRE al final (posiciones 19 y 20 en este hito).
--      Reordenar o insertar una columna nueva en medio rompe cualquier consumidor
--      que haga "select *" o que dependa de la posición.
--   4. "with (security_invoker = on)" va escrito explícitamente en cada
--      "create or replace". El "create or replace" reemplaza las reloptions de la
--      vista: si se omite este with, la vista pasa a security_definer y deja de
--      respetar la RLS del usuario que consulta -- es una falla silenciosa, no
--      lanza ningún error.
--   5. El "grant select" se reemite después, por seguridad, aunque create or
--      replace normalmente lo conserva.
--
-- Efecto esperado en el tablero actual: ninguno. v_merma_diaria, v_merma_semanal,
-- v_merma_por_producto y v_merma_por_tipo nombran sus columnas explícitamente
-- (ninguna hace "select *" sobre merma_costeada), así que dos columnas nuevas al
-- final les son invisibles. Verificado por grep: nadie en web/ hace select directo
-- sobre merma_costeada.

create or replace view merma_costeada
with (security_invoker = on) as
select
  -- ---- columnas 1-18: idénticas a migracion_13_fecha_efectiva.sql, mismo orden ----
  m.sucursal, m.no_transaccion, m.tipo,
  coalesce(m.fecha_merma, m.fecha)  as fecha,          -- fecha efectiva
  m.fecha                            as fecha_captura,
  m.motivo, m.motivo_tipo,
  m.folio, m.no_insumo, m.insumo, m.categoria, m.cantidad,
  sr.region, e.producto_norm, e.tamano,
  p.costo        as costo_unit,
  p.precio_venta as precio_publico,
  case when p.costo is not null then round((m.cantidad * p.costo)::numeric, 2) end as importe_costo,
  -- ---- columnas nuevas de este hito: 19 y 20, al final ----
  m.insumo_norm      as insumo_norm,      -- 19, nueva
  m.costo_confiable  as costo_confiable   -- 20, nueva
from merma m
left join sucursal_region sr on sr.sucursal = m.sucursal
left join equivalencias  e  on e.insumo_norm = m.insumo_norm
left join precios        p  on p.region = sr.region and p.producto_norm = e.producto_norm and p.tamano = e.tamano;

grant select on merma_costeada to authenticated;

notify pgrst, 'reload schema';
