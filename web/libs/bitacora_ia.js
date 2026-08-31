import Anthropic from "@anthropic-ai/sdk";

// Alias y abreviaturas que la IA no puede adivinar sola (bitácora -> catálogo).
// Vive en UN solo lugar para que se use igual en /procesar y /transcribir.
export const ALIAS_HINTS = `- "Brownie" (a secas) = BROWNIE (el postre). SOLO si dice "galleta brownie" = GALLETA BROWNIE. Son productos distintos, no los confundas.
- "Oreo" (a secas) = COOKIES AND CREAM (el pastel). Si dice "Chees Oreo"/"Cheesecake Oreo" = CHEESECAKE COOKIES AND CREAM.
- "Baileys" = TIRAMISU CREMA IRLANDESA
- "Monkey" / "MJ Monkey" / "My Monkey" = MJ MONKEY
- "Selva" = SELVA NEGRA
- "Dubai" = PASTEL DUBAI
- "Italiano" = ITALIANO DE BODAS
- "Lovers" = LOVER S CON FRESA
- "Crepas" / "Mil Crepas" / "Mille Crepe" = MILLE CREPE (Cajeta o Nutella según el sabor)
- "Fresas" (a secas) = FRESAS CON CREMA
- "Chees" o "Cheescake" = CHEESECAKE ; "F." = FLAN ; "M." o "Most." = MOSTACHON ; "G." o "Galleta" = GALLETA
- "Ind." / "Individual" / "Mini" = versión MINI del producto (usa el nombre MINI del catálogo si existe)
- Corrige errores de dedo (ej. "Tortoja"->"Tortuga", "Manzanela"->"Manzanella", "Heleaso"->"Heleado").`;

export function construirPrompt(catalogo) {
  return `Esta es la foto de una hoja "CONTROL DE MERMA" de una pastelería (Dulce Noviembre).
Columnas: FECHA, CANTIDAD, CAUSA DE LA MERMA, PRODUCTO, RESPONSABLE.
Transcribe TODOS los renglones con datos (ignora los vacíos).

CATÁLOGO de productos válidos (para el campo "catalogo" usa EXACTAMENTE uno de estos, tal cual está escrito, o "" si de verdad ninguno corresponde):
${catalogo}

ALIAS y abreviaturas (bitácora -> catálogo):
${ALIAS_HINTS}

Devuelve ÚNICAMENTE un arreglo JSON (sin texto ni markdown), objetos:
{"fecha":"YYYY-MM-DD","cantidad":<numero>,"motivo":"caducidad"|"daño","producto":"<texto leído>","catalogo":"<nombre EXACTO del catálogo o vacío>","tamano":"CH"|"GD"}
Reglas:
- fecha: año 2026. "DD-08"/"DD/08"/"DD-Ago" = 2026-08-DD; si el mes no está claro asume 08. NUNCA uses una fecha futura (posterior a hoy): si te sale futura casi siempre es un error de mes en la libreta, usa 08.
- motivo: "cad"/"caducidad"->"caducidad"; "daño"/"dano"/"merma x daño"->"daño"; si dice ambos usa "daño".
- cantidad: número; si está vacío usa 1.
- tamano: "GD" si dice G/Gde/Grande, "CH" si dice CH/Chico; si no se indica, "GD".
- "catalogo": el nombre del catálogo que corresponde (aplicando los alias y corrigiendo errores de dedo). Muy importante para que se pueda costear.`;
}

// Llama a Claude con las imágenes y devuelve { filas, usage }.
export async function transcribir({ imagenes, catalogo, modelo }) {
  const content = [];
  for (const url of imagenes) {
    const m = /^data:(image\/[a-zA-Z]+);base64,(.+)$/s.exec(String(url));
    if (m) content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  if (!content.length) throw new Error("Las imágenes no tienen un formato válido");
  content.push({ type: "text", text: construirPrompt(catalogo) });

  const anthropic = new Anthropic();
  const msg = await anthropic.messages.create({
    model: modelo,
    max_tokens: 8000,
    messages: [{ role: "user", content }],
  });
  const texto = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  const limpio = texto.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const ini = limpio.indexOf("["), fin = limpio.lastIndexOf("]");
  const filas = JSON.parse(ini >= 0 && fin > ini ? limpio.slice(ini, fin + 1) : limpio);
  if (!Array.isArray(filas)) throw new Error("respuesta no es un arreglo");
  return { filas, usage: msg.usage };
}

// Tarifas de la API (USD por 1M tokens).
const TARIFAS = {
  "claude-sonnet-5": { in: 3.0, out: 15.0, introIn: 2.0, introOut: 10.0, introHasta: "2026-08-31" },
  "claude-opus-5": { in: 5.0, out: 25.0 },
  "claude-opus-4-8": { in: 5.0, out: 25.0 },
  "claude-haiku-4-5": { in: 1.0, out: 5.0 },
};
export function costoUSD(modelo, u) {
  const t = TARIFAS[modelo] || { in: 3, out: 15 };
  const hoy = new Date().toISOString().slice(0, 10);
  const intro = t.introHasta && hoy <= t.introHasta;
  const rin = intro ? t.introIn : t.in;
  const rout = intro ? t.introOut : t.out;
  const inp = (u?.input_tokens || 0) + (u?.cache_read_input_tokens || 0) + (u?.cache_creation_input_tokens || 0);
  return (inp * rin + (u?.output_tokens || 0) * rout) / 1e6;
}
