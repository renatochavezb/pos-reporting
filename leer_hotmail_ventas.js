require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const XLSX = require("xlsx");

const ROOT = __dirname;
const DIRS = {
  inbox: path.join(ROOT, "data", "inbox"),
  error: path.join(ROOT, "data", "error"),
  output: path.join(ROOT, "output"),
  state: path.join(ROOT, "state"),
};
const PROCESSED_IDS_PATH = path.join(DIRS.state, "processed-message-ids.json");

function ensureDirs() {
  Object.values(DIRS).forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
  if (!fs.existsSync(PROCESSED_IDS_PATH)) {
    fs.writeFileSync(PROCESSED_IDS_PATH, "[]", "utf8");
  }
}

function loadProcessedIds() {
  try {
    const raw = fs.readFileSync(PROCESSED_IDS_PATH, "utf8");
    return new Set(JSON.parse(raw));
  } catch (err) {
    return new Set();
  }
}

function saveProcessedIds(ids) {
  fs.writeFileSync(PROCESSED_IDS_PATH, JSON.stringify([...ids], null, 2), "utf8");
}

function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
}

function getCellString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeHeader(value) {
  return getCellString(value)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function looksLikeVentasHeader(row) {
  if (!Array.isArray(row)) return false;
  const normalized = row.map(normalizeHeader);
  return (
    normalized[0] === "CATEGORIA" &&
    normalized[1] === "NO. PRODUCTO" &&
    normalized[2] === "PRODUCTO"
  );
}

function isTotalsRow(row) {
  const text = row.map((v) => normalizeHeader(v)).join(" ");
  return (
    text.includes("SUBTOTAL") ||
    text.includes("TOTAL VENTAS") ||
    text.includes("TOTAL (VENTAS BRUTAS)") ||
    text.includes("IVA")
  );
}

function safeNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const numeric = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseVentasWorkbook(filePath, context) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const ventasSheetName =
    wb.SheetNames.find((name) => normalizeHeader(name) === "VENTAS") ||
    wb.SheetNames.find((name) => normalizeHeader(name).includes("VENTAS"));
  if (!ventasSheetName) {
    throw new Error("No se encontro una hoja llamada VENTAS.");
  }

  const ws = wb.Sheets[ventasSheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const branchFromSheet = getCellString(rows?.[1]?.[0]) || "SIN_SUCURSAL";
  const periodText = getCellString(rows?.[3]?.[0]);

  const headerPositions = [];
  rows.forEach((row, idx) => {
    if (looksLikeVentasHeader(row)) {
      headerPositions.push(idx);
    }
  });

  if (!headerPositions.length) {
    throw new Error("No se encontro el encabezado de ventas por producto.");
  }

  // El ultimo bloque suele ser el listado completo (no el TOP 10).
  const startHeaderIdx = headerPositions[headerPositions.length - 1];
  const data = [];
  for (let i = startHeaderIdx + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    if (looksLikeVentasHeader(row)) continue;
    if (isTotalsRow(row)) break;
    if (!getCellString(row[0]) && !getCellString(row[2])) continue;

    const record = {
      sucursal_excel: branchFromSheet,
      periodo_excel: periodText,
      categoria: getCellString(row[0]),
      no_producto: getCellString(row[1]),
      producto: getCellString(row[2]),
      cantidad: safeNumber(row[3]),
      precio_unitario: safeNumber(row[4]),
      importe: safeNumber(row[5]),
      fecha_correo: context.emailDate || "",
      asunto_correo: context.subject || "",
      archivo_origen: context.fileName || path.basename(filePath),
      remitente_correo: context.from || "",
      message_id: context.messageId || "",
    };
    if (!record.producto) continue;
    data.push(record);
  }

  if (!data.length) {
    throw new Error("No se obtuvieron filas de ventas en el bloque esperado.");
  }

  return data;
}

function toCsvValue(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeCsv(rows, outputPath) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((h) => toCsvValue(row[h])).join(","));
  });
  fs.writeFileSync(outputPath, lines.join("\n"), "utf8");
}

async function processMessage(client, message, processedIds) {
  const source = await client.download(message.uid);
  const parsed = await simpleParser(source);

  const messageId = parsed.messageId || `uid-${message.uid}`;
  if (processedIds.has(messageId)) {
    return { skipped: true, reason: "already-processed", messageId };
  }

  const subject = parsed.subject || "";
  const from = parsed.from?.text || "";
  const emailDate = parsed.date ? parsed.date.toISOString() : "";

  const attachments = (parsed.attachments || []).filter((att) => {
    const name = (att.filename || "").toLowerCase();
    const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls");
    const isInventory = name.startsWith("inv");
    return isExcel && !isInventory;
  });

  if (!attachments.length) {
    processedIds.add(messageId);
    return { skipped: true, reason: "no-valid-attachments", messageId };
  }

  const extractedRows = [];

  for (const att of attachments) {
    const cleanName = sanitizeFileName(att.filename || `archivo_${message.uid}.xlsx`);
    const fileName = `${Date.now()}_${message.uid}_${cleanName}`;
    const filePath = path.join(DIRS.inbox, fileName);
    fs.writeFileSync(filePath, att.content);

    try {
      const rows = parseVentasWorkbook(filePath, {
        subject,
        from,
        emailDate,
        fileName: cleanName,
        messageId,
      });
      extractedRows.push(...rows);
    } catch (err) {
      const failedPath = path.join(DIRS.error, fileName);
      fs.renameSync(filePath, failedPath);
      console.error(`[ERROR] ${cleanName}: ${err.message}`);
    }
  }

  processedIds.add(messageId);
  return { skipped: false, messageId, extractedRows };
}

async function main() {
  ensureDirs();
  const processedIds = loadProcessedIds();

  const required = ["IMAP_USER", "IMAP_PASS"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Faltan variables en .env: ${missing.join(", ")}`);
  }

  const client = new ImapFlow({
    host: process.env.IMAP_HOST || "outlook.office365.com",
    port: Number(process.env.IMAP_PORT || 993),
    secure: String(process.env.IMAP_SECURE || "true") === "true",
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASS,
    },
    logger: false,
  });

  const subjectKeyword = (process.env.SUBJECT_KEYWORD || "VENTAS").toUpperCase();
  const senderAllowList = (process.env.SENDER_ALLOW_LIST || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const allRows = [];
  let totalMessages = 0;
  let totalSkipped = 0;

  await client.connect();
  try {
    await client.mailboxOpen("INBOX");
    const uids = await client.search({ seen: false });

    for (const uid of uids) {
      totalMessages += 1;
      const envelope = await client.fetchOne(uid, { envelope: true });
      const subject = envelope?.envelope?.subject || "";
      const fromAddress = (envelope?.envelope?.from?.[0]?.address || "").toLowerCase();

      if (!subject.toUpperCase().includes(subjectKeyword)) {
        totalSkipped += 1;
        continue;
      }
      if (senderAllowList.length && !senderAllowList.includes(fromAddress)) {
        totalSkipped += 1;
        continue;
      }

      const result = await processMessage(client, { uid }, processedIds);
      if (result.skipped) {
        totalSkipped += 1;
      } else {
        allRows.push(...result.extractedRows);
      }

      if ((process.env.MARK_AS_SEEN || "true") === "true") {
        await client.messageFlagsAdd(uid, ["\\Seen"]);
      }
      if (process.env.MOVE_TO_FOLDER) {
        try {
          await client.messageMove(uid, process.env.MOVE_TO_FOLDER);
        } catch (err) {
          console.warn(
            `[WARN] No se pudo mover UID ${uid} a ${process.env.MOVE_TO_FOLDER}: ${err.message}`
          );
        }
      }
    }
  } finally {
    await client.logout();
    saveProcessedIds(processedIds);
  }

  if (allRows.length) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = path.join(DIRS.output, `ventas_consolidado_${timestamp}.csv`);
    writeCsv(allRows, outPath);
    console.log(`[OK] Filas extraidas: ${allRows.length}`);
    console.log(`[OK] Archivo generado: ${outPath}`);
  } else {
    console.log("[INFO] No hubo filas nuevas para consolidar.");
  }

  console.log(`[INFO] Correos revisados: ${totalMessages}`);
  console.log(`[INFO] Correos omitidos: ${totalSkipped}`);
}

main().catch((err) => {
  console.error("[FATAL]", err.message);
  process.exitCode = 1;
});
