# Agente de reportes Dulce Noviembre — Diseño

Plan del sistema completo. Documento vivo; se actualiza conforme avanzamos.
Última revisión: 16-ago-2026.

Regla de oro: **diseñar para las 12 sucursales, construir 1 primero (Fuentes
Mares) de punta a punta.** Los problemas salen con una tienda, no con doce.

---

## 1. Objetivo y alcance

- **Qué:** agente que genera reportes de **ventas** y **merma** para Dulce
  Noviembre (12 sucursales), diario, con dashboard + exportación a Excel.
- **Alcance de datos:** **piso fijo en el 1 de julio de 2026**. Al conectar una
  sucursal se trae su historial desde esa fecha; de ahí en adelante solo el
  incremento del día. No el histórico de 5 años.
- **Prioridad:** ventas (1), merma (2), financieros (después).
- **Usuarios:** multi-usuario con roles: Supervisión, Gerencia, Dirección.

---

## 2. Arquitectura

```
  12 SUCURSALES  ·  SQL Server 2008 R2  ·  por VPN Hamachi  ·  SOLO LECTURA
        │   usuario reportes_ro (db_datareader)
        │   se lee 1×/día, horario muerto, READ UNCOMMITTED
        ▼
  EXTRACTOR (Node.js)  ·  en esta PC hoy → en la Jetson después
        │   • corre las consultas ya validadas (reglas de negocio aplicadas)
        │   • trae SOLO la ventana que le toca a cada sucursal
        │   • hace UPSERT (idempotente) en Supabase
        ▼
  SUPABASE / Postgres  ·  almacén central + Auth + RLS (roles) + API
        │   • tablas de hechos (facts)  + vistas de resumen
        ▼
  NEXT.js  ·  dashboard con gráficas   +   exportar a Excel
        └─ (fase posterior) chat tipo B: preguntas en lenguaje natural
```

**Por qué copiar y no consultar en vivo:** no golpear el POS de producción,
sobrevivir a que una sucursal esté caída, y tener las 12 juntas para el
consolidado de Dirección.

---

## 3. Reglas de negocio (el corazón — codificar una sola vez)

Estas ya están descubiertas y validadas contra datos reales. Viven en las
consultas de extracción para aplicarse **idénticas siempre**.

**Ventas:**
- Llave del ticket = **(NoTicket, Letra, Sucursal)**. Con una sola columna los
  importes se duplican entre sucursales.
- Venta real = **NoEstadoTicket = 3 (PAGADO)**. El 1 (IMPRESO) es cuenta
  abierta; el 2 es cancelado.
- **Venta neta = Total − IVA.** La propina NO es venta (es del mesero).
- **Día de negocio = el del turno**, no el del reloj. El turno se llama
  `d/M/yyyy-NoCaja`. Los cortes de caja cuadran por turno.
- **Forma de pago real** vive en `TicketCobroFormaPago` (efectivo/tarjeta/…),
  NO en `Tickets.NoFormaDePago` (eso es condición: contado/crédito/cortesía).
- **Importes del encabezado, mix de producto del detalle.** Nunca al revés
  (hay tickets con líneas transferidas/borradas que descuadran el detalle).
- **Costo del detalle, con guarda:** `Tickets.Costo` trae basura. El costo por
  renglón de `TicketDetalles` sirve, PERO se ignoran renglones donde el costo
  supera al precio (error de captura; ej. macarrones con costo $720,300 vs
  venta $300). Esos productos se listan aparte para corregir en el POS.

**Merma:**
- Fuente base = **kardex** `KardexInsumoPuntoDeVenta`, tipo **18** (MERMAS EN
  PUNTO DE VENTA); el 19 es su cancelación y se netea solo.
- Los tipos **29/30 (altas/bajas directas) NO son merma** — son ajuste de
  inventario. Contarlos inflaba la merma ~21%.
- **Valorización:** contra `KardexInsumoCosto` (costo vigente a la fecha).
  Cobertura de costo ~73% → parte de la merma sale en piezas, no en pesos.
- **Motivo:** se enriquece con `MermaPuntoDeVentaDetalles.Motivo` (el kardex no
  lo trae). Kardex y tabla dedicada cuadran exacto (agosto: 49 pzs en ambas).
  · Pendiente: confirmar el enlace kardex.Folio ↔ NoMerma para traer el motivo.

**Restricción técnica:** las bases son **SQL Server 2008 R2** (nivel compat
100). Nada de TRY_CONVERT, IIF, CONCAT, STRING_AGG, LAG/LEAD, OFFSET/FETCH.

---

## 4. Modelo de datos en Supabase

### Tablas de hechos (refresco por UPSERT)
- **`ventas`** — una fila por ticket cobrado. PK `(sucursal, no_ticket, letra)`.
  Campos: dia_negocio, fecha_hora_cobro, tipo_venta, condicion, subtotal, iva,
  total, costo (con guarda), descuento, propina, usuario_cobro, turno.
  · **Sin nombre de cliente** (privacidad).
- **`ventas_detalle`** — una fila por renglón (para el mix de producto).
  Campos: sucursal, no_ticket, letra, no_producto, cantidad, importe_neto,
  costo, borrado (bit).
- **`ventas_pago`** — formas de pago por ticket (para cuadrar el corte de caja).
- **`merma`** — una fila por renglón de merma. Campos: sucursal, fecha,
  no_merma, no_insumo, insumo, categoria, cantidad, costo_unitario, importe,
  motivo, usuario.

### Tablas de catálogo (dimensiones, refresco completo periódico)
- **`sucursales`**, **`productos`**, **`insumos`** — chicas, copia completa.

### Control
- **`sync_estado`** — por (sucursal, tabla): última corrida, filas, estatus.

### Vistas de resumen (lo que leen el dashboard y el Excel)
- `v_ventas_diarias` (sucursal × día: tickets, venta_neta, ticket_prom, margen)
- `v_ventas_por_producto`, `v_ventas_formas_pago`
- `v_merma_diaria`, `v_merma_por_producto`, `v_merma_por_motivo`
- `v_consolidado` (las 12 juntas, para Dirección) — **construida**: es la familia de vistas
  `v_consolidado_*` en Supabase (`v_consolidado_diaria`, `v_consolidado_semanal`,
  `v_consolidado_aporte_semanal`, `v_consolidado_por_producto`, `v_consolidado_por_tipo`,
  `v_consolidado_por_region`, `v_consolidado_cobertura`, `v_consolidado_insumos_hueco`,
  `v_consolidado_costo_sospechoso`, `v_consolidado_regiones_espejo`), servida en
  `/dashboard?sucursal=__cadena__`. Hoy solo cubre merma (2 de 12 sucursales dadas de alta en
  el padrón); ventas sigue sin construirse. Ver `contexto/datos.md` y `contexto/estado.md`.

**Dónde se calcula qué:** las reglas de negocio complejas (día de negocio,
guarda de costo, estado 3, etc.) se aplican en la **consulta de extracción**
(T-SQL, ya escrita). Las sumas y resúmenes son **vistas simples en Postgres**.
Así no duplicamos lógica.

---

## 5. Extracción (el extractor)

- **Tecnología:** Node.js. Conecta a cada sucursal con `mssql` (usuario
  `reportes_ro`, solo lectura) y sube a Supabase con conexión Postgres directa
  o `@supabase/supabase-js` (llave `service_role`, **solo del lado servidor**).
- **Estrategia = backfill al conectar + incremento diario, siempre con UPSERT.**
  La ventana la decide el extractor por sucursal, consultando `max(fecha)` en
  Supabase: sin datos trae desde el piso (`2026-07-01`), con datos trae desde la
  última fecha extraída menos un día de traslape. Ventajas para no tener
  problemas: es **idempotente** (el UPSERT va por `(sucursal, no_transaccion)`),
  se **autocorrige** solo (si un ticket pasó de IMPRESO a PAGADO, si hubo
  cancelación o corrección de costo, se refleja al día siguiente) y **se autocura**
  (si falla una noche, `max(fecha)` sigue atrasado y la corrida siguiente cubre
  el hueco sola). Volumen chico y **plano**: no crece con el tiempo.
- **Por sucursal, en serie**, con timeout. Si una está caída: se salta, se
  marca en `sync_estado`, y las demás siguen. El dashboard usa lo último bueno.
- **Cuándo:** 1×/día en horario muerto (Task Scheduler en esta PC, o cron en la
  Jetson). Marca de agua fina + histórico completo = mejora posterior.

---

## 6. Seguridad

- **Solo lectura en origen:** `reportes_ro` es `db_datareader`. No puede
  escribir nada en el POS, aunque una consulta salga mal.
- **RLS encendido en Supabase** desde el día 1. Sin RLS, la llave pública deja
  leer las tablas a cualquiera. Regla por defecto: negar todo, permitir por rol.
- **Llaves:** la `service_role` (maestra) **solo en el servidor/extractor**,
  nunca en el frontend ni en el repo. La `anon` es la única que ve el navegador.
  Secretos en `.env` fuera de git. Cuenta de Supabase con contraseña fuerte + 2FA.
- **Minimizar exposición:** no subir nombres de clientes; subir solo lo que
  alimenta reportes. Aun filtrado, serían números de negocio, no datos crudos.

---

## 7. Roles y niveles

Mapeo `usuario → sucursales permitidas`, y políticas RLS sobre las tablas de
hechos que filtran por ese mapeo:
- **Supervisión:** solo su(s) sucursal(es).
- **Gerencia:** su grupo de sucursales, con detalle operativo.
- **Dirección:** consolidado de las 12.

---

## 8. Salidas

- **Dashboard (Next.js):** gráficas de ventas (tendencia, por sucursal,
  ticket promedio, formas de pago, mix) y merma (por día, producto, motivo),
  filtrado por rol.
- **Excel:** exportación server-side desde las vistas (mismo enfoque que el
  `reporte_merma_excel.js` actual). Reporte diario programado.

---

## 9. Fases (hoja de ruta)

- **Fase 0 — Acceso ✅ (hecho):** `reportes_ro` en Fuentes Mares, conexión
  remota probada, SQL de ventas y merma validado contra datos reales.
- **Fase 1 — Piloto Fuentes Mares:** proyecto Supabase + esquema; extractor
  Node (backfill + incremento diario, upsert); vistas; **validar ventas contra la
  supervisora**; dashboard básico + Excel.
- **Fase 2 — Escalar a las 11:** `reportes_ro` en cada una (TeamViewer + script);
  el extractor itera sucursales; consolidado.
- **Fase 3 — Roles:** RLS Supervisión / Gerencia / Dirección.
- **Fase 4 — Automatización diaria:** programador + notificación; mover el
  extractor a la Jetson (siempre encendida, bajo consumo).
- **Fase 5 (después) — Chat tipo B** e histórico completo.

---

## 10. Decisiones abiertas / pendientes

1. **`reportes_ro` en las otras 11** — DECIDIDO: sucursal por sucursal (no tocar
   la red Hamachi de las tiendas). Por CADA sucursal hay que resolver DOS cosas,
   no una:
   - **Red:** que la PC/Jetson de reportes alcance esa sucursal por Hamachi.
     Comprobado (16-ago-2026): hoy la PC de renata SOLO alcanza Fuentes Mares
     (`25.0.165.166`). Las IPs del catálogo (`25.149.x`…) son de OTRA red Hamachi
     y no responden. Cada sucursal nueva hay que hacerla alcanzable primero.
   - **Usuario:** TeamViewer al servidor + correr `CREAR_USUARIO_REPORTES.sql`
     (Windows auth, sin password). No reutilizar el `sa` de las ConnectionString.
   Orden sugerido: terminar el piloto con Fuentes Mares (ya alcanzable) antes de
   sumar las 11.
2. **Dónde vive el extractor a largo plazo** — esta PC (¿siempre encendida?) o
   la Jetson. Recomendado: Jetson en Fase 4.
3. **Confirmar enlace merma ↔ motivo** (kardex.Folio = NoMerma). Verificación
   corta y de solo lectura, pendiente.
4. **Nivel de granularidad final en Supabase** — ticket a ticket (sin cliente,
   ya asumido) vs. solo agregados. Empezamos con ticket-a-ticket sin datos
   personales; si prefieres más cerrado, se recorta a agregados.

---

## 11. Stack y estructura (tentativa)

```
pos-reporting/
  sql/                  consultas de extracción (ya existen, validadas)
  extractor/            Node.js: lee sucursales → upsert Supabase
    .env                secretos (fuera de git)
  supabase/
    schema.sql          tablas de hechos, catálogos, vistas, RLS
  web/                  Next.js: dashboard + Excel + auth
```

- **Origen:** SQL Server 2008 R2 (Hamachi, `reportes_ro`).
- **Almacén/API/Auth:** Supabase (Postgres).
- **Extractor:** Node.js (`mssql` + Postgres), programado.
- **App:** Next.js (stack preferido).
- **Ejecución:** esta PC hoy → Jetson después.
