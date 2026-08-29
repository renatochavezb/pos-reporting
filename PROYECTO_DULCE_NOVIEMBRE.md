# Proyecto Dulce Noviembre — Sistema de reportes del POS

> Documento explicativo del proyecto: **qué hace hoy la aplicación** y **qué se
> pretende que haga cuando esté completamente construido**.
> Todo lo aquí escrito proviene de las conversaciones de trabajo y de los
> avances reales del código — no hay supuestos inventados. Lo que aún no existe
> está marcado como *pendiente* o *futuro*.

---

## 1. ¿Qué es esto en una frase?

Un **agente automático de reportes** para la pastelería **Dulce Noviembre** (12
sucursales). Se conecta a los puntos de venta (SeattlePOS), copia la información
a una base de datos propia en la nube (Supabase) y la muestra en un **tablero
web** (dashboard) para poder ver los números sin entrar sucursal por sucursal.

La **prioridad del proyecto es: ventas + merma.** Hoy lo que está construido y
funcionando es la parte de **merma** (el producto que se tira / se pierde). La
parte de **ventas** está planeada pero todavía no construida.

---

## 2. El problema que resuelve

- La cadena tiene **12 sucursales**, cada una con su propio POS **SeattlePOS**
  (misma estructura de base de datos en todas) corriendo sobre **SQL Server
  2008 R2**.
- La información está atrapada en cada tienda. Para saber cuánto se mermó o se
  vendió había que entrar a cada POS por separado.
- Los supervisores llevan sus números a mano (por ejemplo, la merma de la
  semana), y no había una fuente única confiable.

La app junta todo en un solo lugar y lo presenta ya sumado, valorizado en pesos
y comparado semana contra semana.

---

## 3. Cómo está armado (arquitectura)

El flujo de la información es este:

```
   POS de cada sucursal                Copia central               Lo que ves
   (SeattlePOS / SQL Server)           (Supabase / Postgres)       (Next.js)
   ─────────────────────────           ─────────────────────       ───────────
   Fuentes Mares ─┐
   Misiones/Juárez 3 ─┼── Hamachi ──►  Extractor (Node.js) ──►  Base de datos ──►  Dashboard web
   Torres ─┘           (VPN)           extrae solo lectura       Supabase           localhost:4000
   (… hasta 12)                        y sube a Supabase         (vistas, auth)
```

### 3.1 Origen de los datos — el POS
- Software: **SeattlePOS 18**, misma estructura de tablas en las 12 sucursales.
- Motor: **SQL Server 2008 R2** (nivel de compatibilidad 100 — sin funciones
  modernas como `TRY_CONVERT`, `IIF`, `CONCAT`, `LAG/LEAD`).
- Acceso: por **Hamachi**, que ya está puesto como puente hacia todas las
  sucursales (por eso no hace falta instalar cada POS localmente).
- Se creó un usuario **de solo lectura (`reportes_ro`)** en cada sucursal. La
  app **nunca escribe** en el POS; todas las consultas usan
  `READ UNCOMMITTED` para no estorbar la operación de la caja.

Las tablas útiles del POS están documentadas aparte en **`TABLAS.md`** (de las
~435 tablas, solo ~25 sirven para reportes: ventas, inventario/merma, catálogos
y caja).

### 3.2 El extractor (Node.js)
- Carpeta `extractor/`. Programa principal: **`extraer_merma.mjs`**.
- Recorre las sucursales listadas en `sucursales.json` (archivo privado, con
  host, usuario y contraseña de cada una).
- Lee los movimientos de merma de cada sucursal (**solo del mes/ventana en
  curso**, no todo el histórico) y hace **UPSERT** en Supabase.
- Si una sucursal está caída, la marca como error y **sigue con las demás**.
- Tiene un **blindaje**: toma únicamente la sucursal canónica de cada servidor,
  para no arrastrar datos viejos de otra tienda (caso real: la máquina de
  Misiones/Juárez 3 antes era de CANTERA y conserva datos de CANTERA).
- Puede correr **todas** las sucursales o **una sola** si se le pasa el nombre
  como argumento.

### 3.3 La base de datos central — Supabase (Postgres)
- Se eligió **Supabase** sobre SQL Server / Mongo por ser Postgres administrado,
  con autenticación incluida y plan gratuito.
- Guarda la tabla `merma` y varias **vistas** que ya vienen sumadas para el
  dashboard: `v_sucursales_merma`, `v_merma_diaria`, `v_merma_semanal`,
  `v_merma_por_producto`, `v_merma_por_tipo`, además de `sync_estado`
  (estado de cada extracción), `precios`, `precios_cargas` y `equivalencias`.
- Seguridad con **RLS** (vistas `security_invoker`) y **Supabase Auth**
  (correo + contraseña).

### 3.4 El tablero web — Next.js
- Carpeta `web/`. **Next.js 15** (App Router, React 19), **Tailwind CSS v4**.
- Corre en desarrollo en **http://localhost:4000** (`npm run dev`).
- Rutas privadas protegidas por middleware: hay que iniciar sesión para entrar
  a `/dashboard` y `/precios`.

---

## 4. Qué muestra y hace el dashboard hoy

Estética "**Programa DN**" con los colores de la marca (crema, rosa, malva) y
tipografías Libre Caslon Text, Manrope y JetBrains Mono.

### 4.1 Dashboard de merma (`/dashboard`)
- **La semana en curso es lo principal.** Tarjetas grandes: "Semana en curso"
  y "Semana pasada" con su variación (▲/▼).
- **Clasificación de la merma**: caducidad / daño / sin clasificar.
- **Gráfica semanal** (de puntos/línea) del histórico, con opción de ver
  **Costo** o **Unidades**, con promedio y tooltip.
- **Productos críticos**: los más mermados, con barras.
- **Merma por semana** y **últimos días**.
- **Selector por sucursal** (solo aparecen las sucursales con datos reales).
- **Botón "Actualizar" por sucursal**: al darle clic, lee el POS de esa
  sucursal en el momento y trae la info, además de la que ya entra
  automáticamente a las 9pm. (Llama a `/api/actualizar`, que corre el extractor
  y regenera las equivalencias.)
- **Botón de cuenta**: avatar con inicial y menú para cerrar sesión.

### 4.2 Página de precios (`/precios`)
- **Sube la lista de precios/costos** desde un archivo de Excel.
- Opción de **región: Chihuahua, Juárez o Ambas** (los costos difieren entre
  ciudades).
- **Tabla comparativa** de precios por región (producto | tamaño | Chihuahua |
  Juárez).

### 4.3 Cómo se valoriza la merma (la lógica clave)
La merma en el POS viene en cantidades de insumo, no en dinero. Para ponerle
precio se encadena:

```
merma (kardex tipo 18)  →  equivalencias (nombre del insumo → producto con precio)
                        →  precios (región × producto × tamaño)  →  costo en $
```

- Se agrupa por **fecha de merma**: si el comentario del POS trae una fecha, se
  usa esa (formato **día/mes/año**); si no, la fecha de captura.
- Las **equivalencias se regeneran automáticamente** después de cada
  extracción, para que los productos nuevos no queden "sin costo".

### 4.4 Clasificación por comentarios
Se le pidió al personal que en el comentario de la merma escriba **si fue por
caducidad o por daño** y **la fecha real** (día/mes/año). El sistema lee ese
comentario (`clasificarMotivo` en `motivo.mjs`) y:
- Clasifica la merma en **caducidad / daño / cortesía / otro**.
- La asigna al **día que diga el comentario**, no al día en que se capturó.

*(Nota real del avance: al momento de construirlo casi no había comentarios
porque el personal apenas empezó a llenarlos; el sistema ya está listo y
esperando esos datos.)*

---

## 5. Automatización

- **Diario a las 9pm**: Windows Task Scheduler corre el extractor de todas las
  sucursales (`correr_merma.cmd`), que también regenera las equivalencias.
- **Bajo demanda**: el botón "Actualizar" del dashboard corre el extractor de
  una sola sucursal en el momento.

---

## 6. Estado de las sucursales

El trabajo se ha hecho **sucursal por sucursal**. Todas usan la misma base
`SeattlePOS` y el usuario de solo lectura `reportes_ro` (las contraseñas viven
solo en `extractor/sucursales.json`, que **no** se sube al repo).

Algunas máquinas graban en el POS un nombre distinto al de la sucursal real;
se conectan con **blindaje** por el nombre del POS y se **muestran** con el
nombre real (columna `nombre` en la config):

| Zona          | Sucursales conectadas |
|---------------|-----------------------|
| 🏔️ Chihuahua | Américas, Campus, Cantera, Colón, Dosto (POS: Dostoievski), Fuentes Mares, León (POS: Carretera Aldama), Reliz (POS: Andares) |
| 🌵 Juárez     | Misiones (POS: Juárez 3), Torres (POS: Politécnico), Valle (POS: Juárez 2) |

> Importante: **Misiones = Juárez 3** (esa máquina antes fue CANTERA; la
> **Cantera real** es otra tienda, ya conectada aparte).

Pendientes de conectar: **Juárez 1, Palmas, Tres Vías**.

---

## 7. Validaciones reales que ya se hicieron

- **Fuentes Mares**: el dashboard marcaba $3,085 pero el supervisor reportaba
  $5,624. Se encontró que faltaba escribir el campo normalizado del insumo
  (rompía el cruce con equivalencias). Corregido → quedó en **$5,785**, que
  coincide con lo del supervisor.
- **Juárez 3**: el dashboard marcaba $1,122 contra $261 de la supervisora. La
  causa **no fue el código**: en el Excel la columna de costo de Juárez estaba
  duplicada de la de Chihuahua. Se necesita **la lista de costos real de
  Juárez** (acción del usuario).

---

## 8. Reglas de negocio importantes (para no equivocar los números)

- **Merma** = kardex tipo **18**; el tipo **19** la cancela y se netea. Los
  tipos 29/30 son ajustes, **no** merma.
- Un **ticket** se identifica por **3 columnas** (NoTicket, Letra, Sucursal);
  con una sola se duplican los importes.
- **Venta real** = tickets en estado 3 (pagado). **Venta neta** = Total − IVA
  (la propina no es venta).
- El **día de negocio** es el del turno, no el del reloj.
- El **método de pago** vive en `TicketCobroFormaPago`, no en
  `Tickets.NoFormaDePago` (eso es la condición: contado/crédito/cortesía).
- El **costo** correcto es el del detalle del ticket, no el del encabezado.

---

## 9. Seguridad

- **Solo lectura** en el POS (`reportes_ro`, `READ UNCOMMITTED`): la app nunca
  modifica la operación.
- Los archivos con contraseñas y llaves **nunca se suben a GitHub**: están
  ignorados (`extractor/.env`, `extractor/sucursales.json`, `web/.env.local`).
- El repositorio está respaldado en **GitHub**:
  https://github.com/renatochavezb/pos-reporting

---

## 10. Qué se pretende cuando esté completamente construido

Lo siguiente proviene de lo que se ha platicado y de la hoja de ruta implícita
en el trabajo (tablas ya documentadas, sucursales por conectar, etc.). Es el
**objetivo**, todavía no está hecho:

1. **Cubrir las 12 sucursales**, no solo 2–3. Conectar Torres (falta su IP),
   la CANTERA verdadera y el resto.
2. **Reportes de ventas** (hoy solo hay merma). La base ya está estudiada: en
   `TABLAS.md` están mapeadas las tablas de ventas (`Tickets`,
   `TicketDetalles`, `TicketCobro`, `TicketCobroFormaPago`…), lo que permite a
   futuro reportar:
   - ventas netas por sucursal / día / turno,
   - mezcla de productos vendidos,
   - métodos de pago (para cuadrar el corte),
   - cancelaciones y descuentos (control de fugas).
3. **Reportes de caja / arqueo** a partir de `CortesDeCaja` y sus subtablas
   (faltan confirmar columnas cuando la red esté estable).
4. **Merma completa y confiable en toda la cadena**, con:
   - todo el personal llenando los comentarios (motivo + fecha, día/mes/año),
   - la **lista de costos real de Juárez** cargada (hoy viene duplicada de
     Chihuahua).
5. Un **tablero único** donde la dirección/supervisión vea ventas y merma de
   todas las sucursales, comparadas y valorizadas, sin entrar a cada POS —
   siendo la **semana en curso** siempre lo primero que se ve.

---

## 11. Cómo correrlo (referencia rápida)

```bash
# Tablero web (desarrollo) — abre http://localhost:4000
cd web
npm run dev

# Extractor manual de todas las sucursales
cd extractor
npm run merma

# Extractor de una sola sucursal
node extraer_merma.mjs "FUENTES MARES"
```

> El puerto 3000 lo ocupa otro proyecto distinto en esta PC; por eso este
> tablero usa el **4000**.

---

*Documento generado a partir de las conversaciones de trabajo y los avances
reales del proyecto. Si algo cambia (nuevas sucursales, reportes de ventas,
costos de Juárez), conviene actualizar este archivo.*
