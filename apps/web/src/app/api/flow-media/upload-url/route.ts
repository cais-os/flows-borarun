import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  FLOW_MEDIA_UPLOAD_BUCKET,
  buildFlowMediaUploadPath,
  getFlowMediaUploadValidationError,
  type FlowMediaUploadType,
} from "@/lib/flow-media-upload";
import { getCurrentOrganizationContext } from "@/lib/organization";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const mediaType = String(body?.mediaType || "");
  const fileName = String(body?.fileName || "");
  const contentType = String(body?.contentType || "");
  const sizeBytes = Number(body?.sizeBytes || 0);

  const validationError = getFlowMediaUploadValidationError({
    mediaType,
    fileName,
    contentType,
    sizeBytes,
  });

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const context = await getCurrentOrganizationContext();
  const supabase = createServerClient();
  const path = buildFlowMediaUploadPath({
    organizationId: context.organizationId,
    mediaType: mediaType as FlowMediaUploadType,
    fileName,
    contentType,
    uniqueId: randomUUID(),
  });

  const { data, error } = await supabase.storage
    .from(FLOW_MEDIA_UPLOAD_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Falha ao criar URL de upload." },
      { status: 500 }
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from(FLOW_MEDIA_UPLOAD_BUCKET)
    .getPublicUrl(path);

  return NextResponse.json({
    bucket: FLOW_MEDIA_UPLOAD_BUCKET,
    path: data.path || path,
    token: data.token,
    publicUrl: publicUrlData.publicUrl,
  });
}
