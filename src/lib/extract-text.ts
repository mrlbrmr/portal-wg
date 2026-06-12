import path from "path";

export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const ext = path.extname(fileName).toLowerCase();

  if (ext === ".pdf") {
    return extractFromPdf(buffer);
  } else if (ext === ".docx") {
    return extractFromDocx(buffer);
  } else if (ext === ".doc") {
    // .doc legado — extração limitada
    return extractFromDoc(buffer);
  }

  throw new Error("Formato não suportado para extração de texto.");
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    const text = data.text?.trim();

    if (!text || text.length < 50) {
      return "[PDF escaneado ou sem texto extraível. O RH deve revisar o arquivo manualmente.]";
    }

    return text;
  } catch {
    return "[Erro ao extrair texto do PDF. O RH deve revisar o arquivo manualmente.]";
  }
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value?.trim() || "[Documento DOCX sem conteúdo de texto extraível.]";
  } catch {
    return "[Erro ao extrair texto do DOCX. O RH deve revisar o arquivo manualmente.]";
  }
}

async function extractFromDoc(buffer: Buffer): Promise<string> {
  // .doc (Word 97-2003) — extração básica, pode ter ruído
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value?.trim() || "[Documento DOC legado. Conversão para DOCX ou PDF recomendada.]";
  } catch {
    return "[Arquivo .doc legado. Por favor, solicite ao candidato enviar em PDF ou DOCX.]";
  }
}
