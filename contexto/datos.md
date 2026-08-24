# Datos — origen, destino y esquema

## Flujo

```
POS de cada sucursal          Copia central              Lo que ve el usuario
(SeattlePOS / SQL Server)     (Supabase / Postgres)      (Next.js)
──────────────────────        ─────────────────────      ────────────────────
Fuentes Mares ─┐
Misiones/Jz3 ──┼── Hamachi ──► Extractor (Node) ──►  Supabase ──►  Dashboard
Torres ────────┘    (VPN)      solo lectura,         vistas, RLS,  localhost:4000
(… hasta 12)                   UPSERT                auth
```

## Origen: SeattlePOS

- **SeattlePOS 18**, misma estructura de tablas en las 12 sucursales.
- Motor: **SQL Server 2008 R2**.
- Acceso vía **Hamachi** (VPN) — no hace falta instalar nada en cada sucursal.
- Usuario **`reportes_ro`**, solo lectura, en cada sucursal.
- De las **~435 tablas del POS, solo ~25 sirven** para reportes: ventas, inventario/merma,
  catálogos y caja. El mapeo completo está en `TABLAS.md` en la raíz del repo.

### Tablas de ventas ya mapeadas (para cuando se construya el módulo)
`Tickets`, `TicketDetalles`, `TicketCobro`, `TicketCobroFormaPago`.
Permiten: ventas netas por sucursal/día/turno, mezcla de productos, métodos de pago
(para cuadrar el corte), cancelaciones y descuentos.

### Caja
`CortesDeCaja` y sus subtablas. **Faltan confirmar columnas** — no estaba estable la red
cuando se documentó. Verificar antes de construir sobre ellas.

## Destino: Supabase (Postgres)

### Tablas
- `merma` — el hecho principal
- `precios` — por región, producto y tamaño
- `precios_cargas` — historial de las subidas de Excel
- `equivalencias` — nombre de insumo → producto con precio
- `sync_estado` — resultado de cada extracción por sucursal

### Vistas (ya vienen agregadas para el dashboard)
- `v_sucursales_merma`
- `v_merma_diaria`
- `v_merma_semanal`
- `v_merma_por_producto`
- `v_merma_por_tipo`

Todas con **RLS** y `security_invoker`. Autenticación con **Supabase Auth** (correo + contraseña).

## El extractor

- Carpeta `extractor/`, programa principal `extraer_merma.mjs`.
- Lee las sucursales de `sucursales.json` (privado: host, usuario y contraseña de cada una).
- Extrae desde **julio 2026** hacia adelante, nunca el histórico completo del POS. En la
  primera corrida de una sucursal trae todo desde el `2026-07-01`; en las siguientes, solo
  el incremento del día.
- Hace **UPSERT** en Supabase.
- Si una sucursal está caída, la marca como error en `sync_estado` y **sigue con las demás**.
- Puede correr todas o una sola pasándole el nombre como argumento.

## Automatización

- **Diario a las 9pm**: Windows Task Scheduler corre `correr_merma.cmd` (todas las sucursales
  + regeneración de equivalencias).
- **Bajo demanda**: el botón "Actualizar" del dashboard llama a `/api/actualizar`, que corre el
  extractor de una sola sucursal en el momento.
