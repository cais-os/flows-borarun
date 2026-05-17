import { createClient } from "@/lib/supabase/client";

export type MediaUploaderType = "image" | "file" | "audio" | "video";

type SignedUpload = {
  bucket: string;
  path: string;
  token: string;
  publicUrl: string;
};

type PrepareMediaFileDeps = {
  readDataUrl?: (file: File) => Promise<string>;
  requestSignedUpload?: (request: {
    type: MediaUploaderType;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  }) => Promise<SignedUpload>;
  uploadToSignedUrl?: (upload: {
    bucket: string;
    path: string;
    token: string;
    file: File;
    contentType: string;
  }) => Promise<void>;
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

async function requestSignedFlowMediaUpload(request: {
  type: MediaUploaderType;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}) {
  const response = await fetch("/api/flow-media/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mediaType: request.type,
      fileName: request.fileName,
      contentType: request.contentType,
      sizeBytes: request.sizeBytes,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "Falha ao preparar upload da midia."
    );
  }

  return body as SignedUpload;
}

async function uploadToSignedFlowMediaUrl(upload: {
  bucket: string;
  path: string;
  token: string;
  file: File;
  contentType: string;
}) {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(upload.bucket)
    .uploadToSignedUrl(upload.path, upload.token, upload.file, {
      contentType: upload.contentType,
    });

  if (error) {
    throw new Error(error.message);
  }
}

export async function prepareMediaFileForNode(params: {
  type: MediaUploaderType;
  file: File;
} & PrepareMediaFileDeps) {
  const fileName = params.file.name;
  const contentType = params.file.type || "application/octet-stream";

  if (params.type !== "video") {
    const dataUrl = await (params.readDataUrl || readFileAsDataUrl)(params.file);
    return { url: dataUrl, fileName };
  }

  const signedUpload = await (params.requestSignedUpload ||
    requestSignedFlowMediaUpload)({
    type: params.type,
    fileName,
    contentType,
    sizeBytes: params.file.size,
  });

  await (params.uploadToSignedUrl || uploadToSignedFlowMediaUrl)({
    bucket: signedUpload.bucket,
    path: signedUpload.path,
    token: signedUpload.token,
    file: params.file,
    contentType,
  });

  return {
    url: signedUpload.publicUrl,
    fileName,
  };
}
