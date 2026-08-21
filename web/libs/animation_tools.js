/**
 * ROOTS ENGINE — Animation Tools
 * Defines prompt format and capabilities for each supported animation tool.
 * Kling is the default. Changing the active tool adapts all Animation Prompts.
 */

export const ANIMATION_TOOLS = {
  kling: {
    id: "kling",
    name: "Kling AI",
    description: "Física realista, texturas orgánicas, movimientos naturales",
    defaultDuration: "5s",
    availableDurations: ["5s", "10s"],
    strengths: [
      "Física realista de alimentos (crema, frutas, líquidos)",
      "Texturas orgánicas y superficies",
      "Movimientos naturales de ingredientes",
      "Coherencia de producto a través del movimiento",
    ],
    limitations: [
      "Texto dentro del frame puede ser inconsistente",
      "Movimientos de cámara muy específicos pueden requerir ajuste",
    ],
    promptFormat: `[SCENE DESCRIPTION — detailed environment, lighting, atmosphere]
[SUBJECT — exact product description matching reference]
[ACTION — what moves and how: ingredients, camera, environment elements]
[CAMERA MOVEMENT — type and direction of camera motion]
[MOOD — emotional atmosphere of the shot]
[DURATION — 5s or 10s]`,
    promptExample: `Warm editorial kitchen scene, soft lateral light from left window, golden hour atmosphere, marble surface with linen cloth. Exact cake from reference: [product description]. Slow drift of fresh berries rolling gently beside the cake, steam wisps rising from nearby coffee cup. Camera: slow push-in toward cake at 45° angle, very subtle. Warm, inviting, premium food editorial mood. 5s`,
    animationRules: [
      "El pastel NO se deforma, corta, ni modifica en ningún frame",
      "El movimiento es de cámara, ambiente o ingredientes secundarios",
      "Los ingredientes pueden caer, rodar o integrarse — el pastel nunca",
      "Identity Lock aplica en animación: mismos colores, misma estructura",
    ],
  },

  runway: {
    id: "runway",
    name: "Runway Gen-4",
    description: "Movimientos cinemáticos de cámara, control atmosférico",
    defaultDuration: "4s",
    availableDurations: ["4s", "10s"],
    strengths: [
      "Movimientos de cámara cinemáticos y controlados",
      "Atmosféricos y bokeh",
      "Slow motion elegante",
      "Transiciones suaves entre planos",
    ],
    limitations: [
      "Física compleja de múltiples objetos puede ser inconsistente",
      "Interacciones detalladas de ingredientes menos precisas que Kling",
    ],
    promptFormat: `[Camera: CAMERA_MOVEMENT]. [Subject action or stillness]. [Atmosphere and lighting]. [Duration: DURATION]`,
    promptExample: `Camera: slow push-in from 45°, very subtle movement. Cake sits still on golden tray, steam rising gently from nearby espresso. Warm golden hour light streams from left, soft bokeh background with kitchen elements. Duration: 4s`,
    animationRules: [
      "El pastel NO se deforma ni modifica",
      "Especificar movimiento de cámara primero (Runway lo prioriza)",
      "Mantener sujeto principal estático — el movimiento es de cámara",
      "Identity Lock aplica: producto idéntico al reference en todo momento",
    ],
  },

  sora: {
    id: "sora",
    name: "Sora (OpenAI)",
    description: "Narrativa cinemática, coherencia de escena compleja",
    defaultDuration: "5s",
    availableDurations: ["5s", "10s", "20s"],
    strengths: [
      "Coherencia de escena compleja",
      "Narrativa visual fluida",
      "Iluminación y textura de alta calidad",
      "Escenas con múltiples elementos simultáneos",
    ],
    limitations: [
      "Control fino de movimiento de cámara menos predecible",
      "Puede reinterpretar elementos del prompt creativamente",
    ],
    promptFormat: `A cinematic [DURATION] shot of [SCENE DESCRIPTION]. [PRODUCT DESCRIPTION — exact reference]. [ACTION AND MOVEMENT]. [LIGHTING AND ATMOSPHERE]. [STYLE AND MOOD].`,
    promptExample: `A cinematic 5-second shot of a premium bakery editorial scene on a warm marble surface. [Exact cake from reference]. A woman's hand with elegant manicure gently places a golden fork beside the cake as soft morning light streams through a nearby window. Warm, golden, premium food editorial atmosphere. Rich texture, shallow depth of field, 85mm feel.`,
    animationRules: [
      "El pastel NO se modifica — describir como inmutable",
      "Usar lenguaje cinemático narrativo",
      "Especificar 'exact product unchanged' en el prompt para reforzar Identity Lock",
      "Identity Lock: mismos colores y estructura del reference en todo frame",
    ],
  },

  luma: {
    id: "luma",
    name: "Luma Dream Machine",
    description: "Extensión orgánica de imagen a video, movimientos suaves",
    defaultDuration: "5s",
    availableDurations: ["5s"],
    strengths: [
      "Extensión natural desde imagen de referencia",
      "Movimientos orgánicos y suaves",
      "Preserva bien la imagen base",
      "Ideal para movimientos mínimos de alta calidad",
    ],
    limitations: [
      "Movimientos complejos o multiples sujetos menos controlados",
      "Texto en frame puede degradarse",
      "Duración limitada",
    ],
    promptFormat: `[MOVEMENT DESCRIPTION — what moves and how gently]. [CAMERA MOTION if any]. [ATMOSPHERE — subtle environmental details that animate]. [Keep product static and identical to reference image].`,
    promptExample: `Gentle camera drift to the right, very subtle. Candle flame flickers softly in background. Steam rises slowly from nearby coffee cup. Cake remains completely static and identical to reference image. Warm bokeh background breathes slightly. 5s`,
    animationRules: [
      "Siempre partir de una imagen base (Identity Lock garantizado por el source)",
      "Describir movimientos SUTILES — Luma es mejor con movimientos suaves",
      "Incluir siempre 'Keep product static and identical to reference image'",
      "El producto permanece idéntico — solo el ambiente se anima",
    ],
  },

  pika: {
    id: "pika",
    name: "Pika",
    description: "Prompts cortos y directos, movimientos limpios y rápidos",
    defaultDuration: "3s",
    availableDurations: ["3s", "5s"],
    strengths: [
      "Prompts cortos, alta respuesta a instrucciones directas",
      "Movimientos limpios de ingredientes",
      "Rápido de iterar",
      "Bueno para movimientos simples y elegantes",
    ],
    limitations: [
      "Escenas complejas con múltiples elementos puede simplificar",
      "Menos control sobre cámara que Runway",
      "Duración corta",
    ],
    promptFormat: `[MAIN ACTION]. [CAMERA: camera movement]. [STYLE: visual style keywords]. [Product unchanged, no deformation].`,
    promptExample: `Golden fork placed gently beside chocolate cake slice, hand withdraws slowly. Camera: subtle push-in. Style: premium food editorial, warm light, shallow depth of field. Product unchanged, no deformation. 3s`,
    animationRules: [
      "Prompts cortos y directos — Pika responde mejor a instrucciones claras",
      "Especificar 'no deformation' explícitamente",
      "Una acción principal por prompt — no sobrecargar",
      "Identity Lock: 'Product unchanged' debe aparecer en el prompt",
    ],
  },
};

/**
 * Get animation tool by ID
 * @param {string} toolId - Tool identifier
 * @returns {Object} Tool definition
 */
export const getAnimationTool = (toolId) => {
  return ANIMATION_TOOLS[toolId] || ANIMATION_TOOLS.kling;
};

/**
 * Get animation tool instructions for injection into system prompt
 * @param {string} toolId - Tool identifier
 * @returns {string} Formatted instructions for Claude
 */
export const getAnimationToolInstructions = (toolId) => {
  const tool = getAnimationTool(toolId);

  return `## HERRAMIENTA DE ANIMACIÓN ACTIVA: ${tool.name.toUpperCase()}

${tool.description}

### Formato de Animation Prompt para ${tool.name}

Cada Animation Prompt ENHANCED debe seguir este formato exacto:

\`\`\`
${tool.promptFormat}
\`\`\`

Ejemplo de referencia:
"${tool.promptExample}"

### Duraciones disponibles: ${tool.availableDurations.join(" / ")} (default: ${tool.defaultDuration})

### Fortalezas de esta herramienta:
${tool.strengths.map((s) => `- ${s}`).join("\n")}

### Limitaciones a considerar:
${tool.limitations.map((l) => `- ${l}`).join("\n")}

### Reglas de animación ABSOLUTAS (aplican siempre, sin importar la herramienta):
${tool.animationRules.map((r) => `🔴 ${r}`).join("\n")}

Todos los Animation Prompts de esta ejecución se generan en INGLÉS siguiendo el formato de ${tool.name} indicado arriba.`;
};

/**
 * List of tools for UI selector
 */
export const getAnimationToolsList = () => {
  return Object.values(ANIMATION_TOOLS).map(({ id, name, description }) => ({
    id,
    name,
    description,
  }));
};
