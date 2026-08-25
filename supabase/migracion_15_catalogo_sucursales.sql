-- Catálogo de sucursales, regiones y configuración del consolidado de cadena.
--
-- Qué crea: tres tablas nuevas — `sucursales`, `regiones`, `configuracion` — que le dan al
-- consolidado un denominador auditable ("N de 12") y una casa para la traducción entre el
-- nombre que usa el POS y el nombre que ve Renato en pantalla. No toca ninguna tabla ni vista
-- existente. Migración puramente aditiva (RIESGO ALTO fue el hito 1, este no lo es).
--
-- Regla canónico vs. display (léela dos veces antes de tocar la siembra de abajo):
--   `sucursales.sucursal` es el NOMBRE CANÓNICO tal cual lo escribe el POS. Es la llave: aparece
--   en `merma.sucursal`, `sucursal_region.sucursal`, `sync_estado.sucursal` y en todo `group by`
--   o `join ... on` del módulo. Nunca se renombra, nunca se traduce.
--   `sucursales.nombre_display` es el nombre que Renato quiere ver en pantalla. Es `unique` para
--   que ninguna etiqueta se repita, pero NUNCA es llave de nada: ningún `group by`, ningún
--   `join on`, ningún `where`, ninguna URL se arma con `nombre_display`.
--   Caso concreto de este hito: en el POS y en todos los datos existentes la sucursal se llama
--   `JUAREZ 3`. Renato la quiere ver en pantalla como `MISIONES`. Si se invierten los dos valores
--   en la siembra de abajo, el módulo entero se cae porque ningún `join` encuentra nada:
--   `merma.sucursal = 'JUAREZ 3'`, nunca `'MISIONES'`.
--
-- Por qué solo lectura para `authenticated`: el padrón de sucursales es el denominador de la
-- honestidad del número que se muestra ("N de 12"). Si el navegador pudiera insertar, actualizar
-- o borrar filas, cualquier sesión autenticada podría inflar o desinflar ese denominador. Por eso
-- las tres tablas solo llevan `grant select`, nunca `insert`/`update`/`delete` para `authenticated`.
-- Las filas se cargan desde el Table Editor de Supabase, que usa `service_role` y salta RLS.
--
-- Agregar las otras 10 sucursales al padrón es insertar filas en `sucursales` (y, si aplica, en
-- `sucursal_region` y `precios`), no escribir código: sin migración nueva, sin redeploy.

-- ============================================================================
-- sucursales — el padrón
-- ============================================================================
create table if not exists sucursales (
  sucursal        text primary key,                    -- nombre canónico del POS, llave en datos
  nombre_display  text not null unique,                 -- nombre en pantalla, nunca llave
  region          text,                                 -- CHIHUAHUA | JUAREZ | null
  estado          text not null default 'pendiente'
    check (estado in ('conectada','pendiente','baja')),
  orden           int,
  alias           text[] not null default '{}',
  notas           text,
  actualizado_en  timestamptz not null default now()
);

alter table sucursales enable row level security;
grant select on sucursales to authenticated;
drop policy if exists sucursales_lectura on sucursales;
create policy sucursales_lectura on sucursales for select to authenticated using (true);

-- Siembra idempotente. `sucursal` es el nombre canónico del POS (llave), `nombre_display` es
-- lo que se ve en pantalla. JUAREZ 3 es como el POS escribe la sucursal en merma.sucursal y en
-- sucursal_region; MISIONES es como Renato quiere verla en pantalla. Si inviertes los dos
-- valores, el módulo entero se cae porque ningún join encuentra nada.
insert into sucursales (sucursal, nombre_display, region, estado, orden) values
  ('FUENTES MARES', 'FUENTES MARES', 'CHIHUAHUA', 'conectada', 1),
  ('JUAREZ 3',       'MISIONES',      'JUAREZ',     'conectada', 2)
on conflict (sucursal) do nothing;

-- ============================================================================
-- regiones
-- ============================================================================
create table if not exists regiones (
  region          text primary key,
  nombre_display  text not null,
  es_referencia   boolean not null default false,   -- lista base contra la que se detecta el espejo
  orden           int
);

alter table regiones enable row level security;
grant select on regiones to authenticated;
drop policy if exists regiones_lectura on regiones;
create policy regiones_lectura on regiones for select to authenticated using (true);

-- CHIHUAHUA es la región de referencia (es_referencia = true) porque es contra la que se detecta
-- el espejo de costos: su lista de precios es la confiable y verificada. JUAREZ es la provisional
-- (es_referencia = false) porque su columna de costos venía duplicada de la de Chihuahua (ver
-- contexto/decisiones.md, "Juárez 3 — NO era el código"). Marcar a CHIHUAHUA como provisional
-- sería una acusación falsa: los datos muestran lo contrario.
insert into regiones (region, nombre_display, es_referencia, orden) values
  ('CHIHUAHUA', 'Chihuahua', true, 1),
  ('JUAREZ',    'Juárez',    false, 2)
on conflict (region) do nothing;

-- ============================================================================
-- configuracion
-- ============================================================================
create table if not exists configuracion (
  clave           text primary key,
  valor           text not null,
  descripcion     text
);

alter table configuracion enable row level security;
grant select on configuracion to authenticated;
drop policy if exists configuracion_lectura on configuracion;
create policy configuracion_lectura on configuracion for select to authenticated using (true);

insert into configuracion (clave, valor, descripcion) values
  ('sucursales_en_padron', '12',   'denominador de "N de 12" mientras falten filas en sucursales'),
  ('horas_sin_corrida_alerta', '36', 'horas sin corrida para marcar "sin corrida reciente"'),
  ('espejo_min_productos', '5',   'mínimo de productos comparables para declarar espejo de regiones'),
  ('espejo_umbral_pct', '0.90',  'proporción de costos idénticos para declarar espejo')
on conflict (clave) do nothing;

notify pgrst, 'reload schema';
