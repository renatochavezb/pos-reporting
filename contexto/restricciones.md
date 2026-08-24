# Restricciones técnicas

Límites duros del entorno. No son preferencias: código que los ignore falla en producción.

## SQL Server 2008 R2, nivel de compatibilidad 100

El POS corre sobre un motor viejo. **No están disponibles**:

- `TRY_CONVERT` / `TRY_CAST`
- `IIF`
- `CONCAT`
- `LAG` / `LEAD` y funciones de ventana modernas
- `OFFSET ... FETCH`

Cualquier consulta al POS debe escribirse con sintaxis compatible con 2008 R2:
`CASE WHEN` en lugar de `IIF`, `+` con `CAST` explícito en lugar de `CONCAT`,
subconsultas o self-joins en lugar de `LAG`/`LEAD`.

## Acceso de solo lectura

- Usuario **`reportes_ro`** en cada sucursal. La aplicación **nunca escribe en el POS**.
- Todas las consultas usan **`READ UNCOMMITTED`** para no bloquear la operación de la caja.
  Una consulta pesada sin ese hint puede detener las ventas de la tienda.

## Red

- El acceso a las sucursales es por **Hamachi**. Las IPs dependen de que la máquina de la
  sucursal esté encendida y conectada.
- Una sucursal caída **no debe abortar la corrida**: se marca el error en `sync_estado` y se
  continúa con las demás.

## Blindaje de sucursal canónica

**Caso real:** la máquina de Misiones / Juárez 3 antes pertenecía a CANTERA y **conserva datos
viejos de CANTERA en su base**.

El extractor toma **únicamente la sucursal canónica de cada servidor**. Si se quita ese
blindaje, se arrastran datos de otra tienda y los totales quedan inflados sin ninguna señal
de error.

Además: **Misiones y Juárez 3 son la misma sucursal.** La CANTERA verdadera es una tienda
distinta, todavía no conectada.

## Ventana de extracción

El extractor **nunca lee el histórico completo del POS**. El piso es el **1 de julio de 2026**:
no se extrae nada anterior a esa fecha.

La ventana la decide el extractor **por sucursal**, consultando `max(fecha)` de esa sucursal
en Supabase:

- **Sucursal sin datos** → backfill desde el piso. Pasa una sola vez, al conectarla.
- **Sucursal con datos** → solo el incremento: desde la última fecha ya extraída menos un día
  de traslape, que alcanza las capturas tardías y las cancelaciones (tipo 19).

Así el volumen que se le pide a cada sucursal cada noche se mantiene plano, que es justo lo que
esta restricción protege. Releer un día es seguro: el UPSERT va por
`(sucursal, no_transaccion)` y actualiza en vez de duplicar.

Ampliar la ventana más allá de esto sigue prohibido sin medir el impacto: la conexión va por
VPN sobre la red de la tienda.

## Puertos

El tablero corre en **4000**, no en 3000. El 3000 lo ocupa otro proyecto en la misma PC.

## Archivos que nunca se tocan

`extractor/.env`, `extractor/sucursales.json`, `web/.env.local`.
Contienen las credenciales de las 12 sucursales y las llaves de Supabase. Están en
`.gitignore` y no deben leerse, editarse ni subirse.
