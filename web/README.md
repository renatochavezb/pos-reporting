# Dulce Noviembre — Content Engine

Sistema de generación de contenido para redes sociales impulsado por IA. Construido sobre el sistema **ROOTS** (Brain + Engine + Guard), genera el paquete completo de contenido diario para Instagram y TikTok a partir de las fotografías del pastel del día.

---

## Requisitos

- Node.js 18+
- Cuenta de Google (para el login)
- [Google OAuth credentials](https://console.cloud.google.com) (Client ID + Secret)
- [Anthropic API Key](https://console.anthropic.com) (Claude)

---

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de ambiente
cp .env.example .env.local
```

Edita `.env.local` y llena las variables necesarias:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=cualquier-string-aleatorio-seguro
AUTH_TRUST_HOST=http://localhost:3000

# Google OAuth
GOOGLE_ID=tu-google-client-id
GOOGLE_SECRET=tu-google-client-secret

# Claude / Anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

```bash
# 3. Iniciar el servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## Configuración de Google OAuth

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un proyecto o usa uno existente
3. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth**
4. Tipo: **Aplicación web**
5. Agrega en **Orígenes autorizados**:
   ```
   http://localhost:3000
   ```
6. Agrega en **URIs de redireccionamiento autorizados**:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
7. Copia el **Client ID** y **Client Secret** a tu `.env.local`

---

## Cómo usar la app

### Acceso

Entra a la app con tu cuenta de Google. Solo usuarios autorizados pueden acceder.

---

### Flujo de trabajo diario

#### Paso 1 — Seleccionar herramienta de animación

En el header del dashboard, selecciona la herramienta de video que usarás para animar las escenas. Los prompts de animación se adaptan automáticamente al formato de cada herramienta:

| Herramienta | Mejor para |
|---|---|
| **Kling AI** (default) | Física realista, texturas orgánicas, movimientos naturales |
| **Runway Gen-4** | Movimientos cinemáticos de cámara, control atmosférico |
| **Sora (OpenAI)** | Narrativa cinemática, coherencia de escena compleja |
| **Luma Dream Machine** | Extensión orgánica desde imagen base, movimientos suaves |
| **Pika** | Prompts cortos, movimientos limpios y rápidos |

---

#### Paso 2 — Iniciar la ejecución del día

Escribe en el chat el comando del día. Usa el botón de acceso rápido o escríbelo manualmente:

```
Ejecuta 25 de abril
```

Para contenido promocional:
```
Ejecuta Promo
```

Para análisis estratégico de la cuenta:
```
EJECUTA ANÁLISIS ROOTS
```

> **Importante:** Si tienes un Estado de Rotación de la sesión anterior, pégalo al inicio del chat o junto con el comando de ejecución para garantizar variación de contenido.

---

#### Paso 3 — Subir las fotografías de referencia

El sistema **siempre** solicitará las fotos del pastel antes de generar cualquier contenido. Esto es una regla absoluta del sistema ROOTS.

Haz clic en el botón **📸** (cámara) en el área de input, o arrastra las fotos al área de upload que aparece automáticamente.

Sube las siguientes fotos:
- **Foto del pastel entero** (vista frontal)
- **Foto del pastel a 45°** (muestra la decoración superior)
- **Foto de la rebanada** (si existe — para mostrar el interior)

Formato aceptado: JPEG, PNG o WEBP · Máximo 5MB por foto

---

#### Paso 4 — Confirmar el análisis visual

El sistema analizará las fotos y describirá lo que ve. **Confirma si el análisis es correcto** antes de que proceda con la generación.

---

#### Paso 5 — Recibir el paquete completo

El Content Engine genera todo el contenido del día:

| Formato | Descripción |
|---|---|
| **Reel** | Thumbnail + escenas con prompt de imagen + prompt de animación |
| **TikTok** | Versión independiente con diferentes escenas y hook más agresivo |
| **Dirección musical** | Mood, tempo, instrumentos + prompt para Suno (≤200 caracteres) |
| **Voiceover** | Decisión de si aplica + texto listo para grabar |
| **Stories** | Mínimo 3 obligatorias: macro textura, hero shot, contexto/escena |
| **Caption** | Estructura: hook + referencia sensorial + ingrediente + cierre de certeza |
| **CTA** | Llamada a la acción según el Stage activo del día |
| **Hashtags** | Set completo: marca + nicho + alcance + comunidad |
| **Horarios** | Tiempos exactos de publicación para cada formato |

---

#### Paso 6 — Guardar el Estado de Rotación

Al final de cada entrega, el sistema genera un bloque como este:

```
--- ESTADO DE ROTACIÓN (copiar para próxima sesión) ---
ESTADO DE ROTACIÓN — 25/04/2025
Ángulo editorial: Deseo Puro
Estilo visual: Editorial Gastronómico
Tipo de hook: Curiosidad
Interacción humana: Manos femeninas íntimas
Estilo de manos: Manicura magenta profundo
ROOTS Stage: Desire
Producto ejecutado: Pastel de tres leches con fresas
```

**Copia este bloque y pégalo al inicio de tu próxima sesión.** Esto garantiza que el sistema no repita el mismo ángulo editorial, estilo visual ni tipo de hook en días consecutivos.

---

### Usar los prompts generados

Los prompts de imagen van en herramientas como **Midjourney**, **Ideogram** o **Flux**.  
Los prompts de animación van en la herramienta seleccionada (**Kling**, **Runway**, **Sora**, **Luma** o **Pika**).  
Los prompts de Suno van en [suno.com](https://suno.com) para generar la música del video.

Puedes copiar cualquier bloque de texto del chat con el botón **"Copiar"** que aparece al hacer hover sobre la respuesta, o **"Copiar todo"** para copiar el mensaje completo.

---

## Sistema ROOTS

El corazón de la app es el sistema **ROOTS**, un motor de decisión estratégica de 3 capas:

### 🧠 ROOTS BRAIN — Estrategia
Define la identidad de marca, el sistema de voz, los ángulos editoriales, el target y las métricas objetivo. Garantiza que todo el contenido sea coherente con el posicionamiento de Dulce Noviembre.

### ⚙️ ROOTS ENGINE — Generación
Ejecuta el flujo de creación de contenido siguiendo reglas estrictas de producto (Identity Lock), sistema visual de 7 estilos, formatos de contenido y estructura de entrega.

### 🛡️ ROOTS GUARD — Validación
Valida automáticamente 5 pasos antes de entregar cualquier contenido: integridad del producto, completitud de prompts, coherencia estratégica, variación y completitud de estructura.

---

## Reglas de producto (Identity Lock)

El sistema tiene reglas absolutas para proteger la integridad visual del producto:

- Los colores del pastel son **inmutables** — se replican exactamente como en la referencia
- El relleno **nunca se inventa** sin foto de la rebanada
- El pastel **siempre está sobre un soporte** (charola dorada o portapasteles) — nunca sobre la mesa directamente
- **Todos los utensilios son dorados** — el tenedor dorado es obligatorio en todas las escenas
- **Sin ciclorama** — siempre hay ambiente real con profundidad y textura

---

## Estructura del proyecto

```
shipearapido/
├── app/
│   ├── page.js                    # Landing / Login con Google
│   ├── (private)/
│   │   └── (user)/
│   │       └── dashboard/
│   │           └── page.js        # Dashboard principal — Chat Interface
│   └── api/
│       └── engine/
│           ├── chat/              # Endpoint de streaming con Claude
│           ├── upload/            # Endpoint de subida de fotos
│           └── tools/             # Endpoint de lista de herramientas
├── libs/
│   ├── auth.js                    # Configuración de NextAuth (Google OAuth + JWT)
│   ├── claude.js                  # Cliente de Anthropic
│   └── animation_tools.js         # Definiciones de herramientas de animación
├── prompts/
│   └── roots_system.js            # System prompt completo de ROOTS (Brain + Engine + Guard)
└── middleware.js                  # Protección de rutas privadas
```

---

## Variables de ambiente

| Variable | Requerida | Descripción |
|---|---|---|
| `NEXTAUTH_URL` | ✅ | URL base de la app |
| `NEXTAUTH_SECRET` | ✅ | Secret para JWT (cualquier string seguro) |
| `AUTH_TRUST_HOST` | ✅ | Igual que NEXTAUTH_URL |
| `GOOGLE_ID` | ✅ | Google OAuth Client ID |
| `GOOGLE_SECRET` | ✅ | Google OAuth Client Secret |
| `ANTHROPIC_API_KEY` | ✅ | API Key de Anthropic (Claude) |
| `MONGODB_URI` | ❌ | No requerida para esta app |
| `STRIPE_*` | ❌ | No requerida para esta app |
| `RESEND_API_KEY` | ❌ | No requerida para esta app |
