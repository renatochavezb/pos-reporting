import { NextResponse } from "next/server";
import { auth } from "@/libs/auth";
import sharp from "sharp";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_INPUT_MB = 20; // Accept up to 20MB input
const MAX_INPUT_BYTES = MAX_INPUT_MB * 1024 * 1024;
const TARGET_SIZE_BYTES = 3.5 * 1024 * 1024; // Compress to ~3.5MB for safe Claude API headroom
const MAX_DIMENSION = 1568; // Anthropic recommended max dimension

/**
 * POST /api/engine/upload
 * Receives reference photo(s) for Identity Lock.
 * Resizes and compresses images to stay within Anthropic's 5MB limit.
 * Returns base64-encoded images ready for Claude API.
 *
 * Body: FormData with field "photos" (one or multiple files)
 * Returns: { images: Array<{ base64, mediaType, name, size }> }
 */
export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const files = formData.getAll("photos");

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No photos received" },
        { status: 400 }
      );
    }

    const images = [];

    for (const file of files) {
      // Validate type
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Tipo de archivo no válido: ${file.name}. Solo JPEG, PNG, WEBP o GIF.` },
          { status: 400 }
        );
      }

      // Validate raw input size
      if (file.size > MAX_INPUT_BYTES) {
        return NextResponse.json(
          { error: `${file.name} supera el límite de ${MAX_INPUT_MB}MB.` },
          { status: 400 }
        );
      }

      // Convert to buffer
      const arrayBuffer = await file.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuffer);

      // Resize + compress with sharp
      let processedBuffer;
      let outputMediaType = "image/jpeg";

      try {
        let pipeline = sharp(inputBuffer).rotate(); // auto-rotate from EXIF

        // Get metadata to check dimensions
        const metadata = await sharp(inputBuffer).metadata();
        const { width = 0, height = 0 } = metadata;

        // Resize if larger than max dimension (preserving aspect ratio)
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
            fit: "inside",
            withoutEnlargement: true,
          });
        }

        // Compress to JPEG at quality 85 — good balance of quality vs size
        processedBuffer = await pipeline
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();

        // If still too large, reduce quality further
        if (processedBuffer.length > TARGET_SIZE_BYTES) {
          processedBuffer = await sharp(inputBuffer)
            .rotate()
            .resize(MAX_DIMENSION, MAX_DIMENSION, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({ quality: 70, progressive: true })
            .toBuffer();
        }

        // Last resort: resize smaller
        if (processedBuffer.length > TARGET_SIZE_BYTES) {
          processedBuffer = await sharp(inputBuffer)
            .rotate()
            .resize(1000, 1000, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({ quality: 70, progressive: true })
            .toBuffer();
        }

      } catch (sharpError) {
        console.error("Sharp processing error:", sharpError);
        // Fallback: use original buffer if sharp fails
        processedBuffer = inputBuffer;
        outputMediaType = file.type;
      }

      const base64 = processedBuffer.toString("base64");

      images.push({
        base64,
        mediaType: outputMediaType,
        name: file.name,
        size: processedBuffer.length,
        originalSize: file.size,
      });
    }

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Error procesando las fotos" },
      { status: 500 }
    );
  }
}
