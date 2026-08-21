-- ============================================================
--  ESQUEMA SUPABASE (Postgres) — MERMA  ·  piloto Fuentes Mares
--  Correr una vez en el SQL Editor de Supabase.
--  Idempotente: se puede volver a correr sin romper nada.
-- ============================================================

-- ---------- tabla de hechos: una fila por movimiento de merma ----------
create table if not exists merma (
  sucursal        text        not null,
  no_transaccion  bigint      not null,   -- id unico por sucursal (del kardex)
  tipo            smallint    not null,   -- 18 = merma, 19 = cancelacion
  fecha           date        not null,
  fecha_hora      timestamp   not null,
  folio           bigint,                 -- sesion de captura (= NoMerma)
  no_insumo       text,
  insumo          text,
  categoria       text,
  unidad          text,
  cantidad        numeric(18,3) not null, -- piezas (+ merma, - cancelacion)
  costo_unitario  numeric(18,4),
  importe         numeric(18,2),          -- pesos = cantidad * costo_unitario
  motivo          text,
  usuario         text,
  modulo          text,
  actualizado_en  timestamptz not null default now(),
  primary key (sucursal, no_transaccion)
);

create index if not exists ix_merma_fecha    on merma (sucursal, fecha);
create index if not exists ix_merma_insumo   on merma (sucursal, no_insumo);

-- ---------- control de sincronizacion (para saber cuando corrio) ----------
create table if not exists sync_estado (
  sucursal      text        not null,
  tabla         text        not null,
  ultima_corrida timestamptz,
  filas         integer,
  estatus       text,
  detalle       text,
  primary key (sucursal, tabla)
);

-- ---------- vistas de resumen (lo que leera el dashboard/Excel) ----------
create or replace view v_merma_diaria as
select sucursal,
       fecha,
       sum(cantidad)               as piezas,
       sum(importe)                as pesos,
       count(distinct no_insumo)   as productos,
       count(distinct folio)       as sesiones
from merma
group by sucursal, fecha;

create or replace view v_merma_por_producto as
select sucursal,
       no_insumo,
       max(insumo)     as insumo,
       max(categoria)  as categoria,
       sum(cantidad)   as piezas,
       sum(importe)    as pesos,
       count(*)        as movimientos
from merma
group by sucursal, no_insumo;

create or replace view v_merma_por_motivo as
select sucursal,
       coalesce(nullif(btrim(motivo), ''), '(sin motivo capturado)') as motivo,
       sum(cantidad) as piezas,
       sum(importe)  as pesos
from merma
group by sucursal, coalesce(nullif(btrim(motivo), ''), '(sin motivo capturado)');

-- ---------- seguridad ----------
-- RLS encendido desde el dia 1. El extractor escribe con la llave
-- service_role (la salta). Cuando armemos el dashboard agregamos las
-- politicas de lectura por rol (Supervision/Gerencia/Direccion).
alter table merma        enable row level security;
alter table sync_estado  enable row level security;
