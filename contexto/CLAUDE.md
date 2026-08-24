# pos-reporting — Dulce Noviembre

Sistema de reportes para la cadena de pastelerías Dulce Noviembre (12 sucursales).
Lee los POS SeattlePOS de cada sucursal, copia los datos a Supabase y los muestra en un
tablero web. Hoy funciona la parte de **merma**; **ventas** está planeada, no construida.

## Estructura del repo

Son dos proyectos en un mismo repositorio:

- `extractor/` — Node.js. Lee SQL Server de cada sucursal y hace UPSERT en Supabase.
  Programa principal: `extraer_merma.mjs`.
- `web/` — Next.js 15 (App Router, React 19) + Tailwind v4. Corre en **puerto 4000**
  (el 3000 lo ocupa otro proyecto en esta PC).
- `sql/` — consultas de referencia contra el POS.
- `supabase/` — esquema, vistas y migraciones.

## Comandos

```bash
cd web && npm run dev          # tablero en http://localhost:4000
cd web && npm run build        # verificar que el tablero compila
cd extractor && npm run merma  # extraer todas las sucursales
node extraer_merma.mjs "FUENTES MARES"   # una sola sucursal
```

## Antes de trabajar, lee el contexto

- **Antes de definir cualquier reporte o módulo nuevo** → `contexto/negocio.md`.
  Contiene las reglas que determinan si un número sale bien o mal. No las deduzcas del código.
- **Antes de diseñar esquema o consultas** → `contexto/datos.md`.
- **Antes de tocar cualquier consulta al POS** → `contexto/restricciones.md`.
  El motor es SQL Server 2008 R2 y no soporta sintaxis moderna.
- **Antes de proponer cambiar una decisión de arquitectura** → `contexto/decisiones.md`.
  Varias ya se evaluaron y descartaron por razones que siguen vigentes.
- **Estado actual de sucursales conectadas** → `contexto/estado.md` (cambia seguido).

## Reglas de código

- Español en UI, comentarios y commits.
- El extractor usa módulos `.mjs`. El web usa TypeScript.
- Toda consulta al POS es **solo lectura**, con `READ UNCOMMITTED`.
- Las vistas de Supabase son `security_invoker` con RLS.

## No tocar

- `extractor/.env`, `extractor/sucursales.json`, `web/.env.local` — credenciales de las
  12 sucursales. Nunca se leen, nunca se suben, nunca se editan.
- El blindaje de sucursal canónica en el extractor (ver `contexto/restricciones.md`).
