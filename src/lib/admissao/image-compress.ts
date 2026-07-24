// Compressão de imagem no navegador (client-only) para o formulário de admissão.
//
// Motivo: fotos de documentos tiradas no celular costumam ter 3–8 MB, mas a
// função serverless da Vercel rejeita corpos de requisição acima de ~4,5 MB.
// Reduzimos a imagem para no máx. 1600px e reexportamos como JPEG antes do
// upload. Bônus: fotos HEIC do iPhone são convertidas para JPEG (o iOS decodifica
// HEIC nativamente ao desenhar no canvas), evitando o erro de "formato inválido".
//
// Arquivos que não são imagem (PDF/DOC) passam sem alteração.

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.8

/** Guarda de segurança abaixo do limite de ~4,5 MB da função serverless da Vercel. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

function isImage(file: File): boolean {
  return file.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)
}

function fit(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h }
  const ratio = Math.min(max / w, max / h)
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) }
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // imageOrientation 'from-image' respeita a rotação EXIF das fotos do celular.
      const opts = { imageOrientation: 'from-image' } as unknown as ImageBitmapOptions
      return await createImageBitmap(file, opts)
    } catch {
      // cai no fallback com HTMLImageElement
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao carregar imagem')) }
    img.src = url
  })
}

/**
 * Reduz e recomprime uma imagem para caber com folga no limite de upload.
 * Em qualquer falha (ou se não for imagem), devolve o arquivo original.
 */
export async function compressImage(file: File): Promise<File> {
  if (!isImage(file)) return file

  try {
    const source = await loadImage(file)
    const srcW = (source as HTMLImageElement).naturalWidth || source.width
    const srcH = (source as HTMLImageElement).naturalHeight || source.height
    const { width, height } = fit(srcW, srcH, MAX_DIMENSION)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(source, 0, 0, width, height)
    if ('close' in source && typeof source.close === 'function') source.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    )
    if (!blob) return file

    // Se o original já for um JPEG menor, mantém o original.
    if (blob.size >= file.size && file.type === 'image/jpeg') return file

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], newName, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
