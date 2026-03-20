import { NextResponse } from "next/server";
import { getCurrentOrganizationContext } from "@/lib/organization";

export async function GET() {
  try {
    const context = await getCurrentOrganizationContext();

    return NextResponse.json({
      organizationId: context.organizationId,
      organizationName: context.organizationName,
      role: context.role,
      email: context.user.email,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Not authenticated" },
      { status: 401 }
    );
  }
}
