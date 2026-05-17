export const FLOW_MEDIA_UPLOAD_BUCKET = "images";

export type FlowMediaUploadType = "video";

const MIME_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "video/3gp": "3gp",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

function getBasename(fileName: string) {
  return fileName.split(/[\\/]/).pop()?.trim() || "media";
}

function getSafeExtension(fileName: string, contentType: string) {
  const basename = getBasename(fileName);
  const extensionMatch = basename.match(/\.([a-z0-9]{1,12})$/i);
  const extension = extensionMatch?.[1]?.toLowerCase();

  if (extension) return extension;

  return MIME_EXTENSION_BY_CONTENT_TYPE[contentType.toLowerCase()] || "bin";
}

function getSafeFileStem(fileName: string) {
  const basename = getBasename(fileName).replace(/\.[^.]+$/, "");
  const normalized = basename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "media";
}

export function buildFlowMediaUploadPath(params: {
  organizationId: string;
  mediaType: FlowMediaUploadType;
  fileName: string;
  contentType: string;
  uniqueId: string;
}) {
  const extension = getSafeExtension(params.fileName, params.contentType);
  const fileStem = getSafeFileStem(params.fileName);

  return [
    params.organizationId,
    "flow-media",
    params.mediaType,
    `${params.uniqueId}-${fileStem}.${extension}`,
  ].join("/");
}

export function getFlowMediaUploadValidationError(params: {
  mediaType: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}) {
  if (params.mediaType !== "video") {
    return "Tipo de midia nao suportado para upload.";
  }

  if (!params.fileName.trim()) {
    return "Nome do arquivo e obrigatorio.";
  }

  if (!Number.isFinite(params.sizeBytes) || params.sizeBytes <= 0) {
    return "Arquivo vazio ou invalido.";
  }

  if (!params.contentType.toLowerCase().startsWith("video/")) {
    return "Envie um arquivo de video valido.";
  }

  return null;
}
