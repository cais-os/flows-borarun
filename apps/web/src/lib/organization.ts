import type { User } from "@supabase/supabase-js";
import { createServerClient, createSupabaseServer } from "@/lib/supabase/server";

export type OrganizationSettings = {
  organization_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  subscription_plan: "free" | "premium";
  business_name: string | null;
  business_phone: string | null;
  meta_phone_number_id: string | null;
  meta_waba_id: string | null;
  meta_app_id: string | null;
  meta_app_secret: string | null;
  meta_system_token: string | null;
  meta_webhook_verify_token: string | null;
  meta_graph_api_version: string | null;
  strava_client_id: string | null;
  strava_client_secret: string | null;
  strava_scopes: string[] | null;
  mercado_pago_access_token: string | null;
  mercado_pago_public_key: string | null;
  mercado_pago_webhook_secret: string | null;
  subscription_nudge_message: string | null;
};

type OrganizationMembershipRow = {
  organization_id: string;
  role: string;
  organizations: {
    id: string;
    name: string;
  } | null;
};

export type OrganizationContext = {
  user: User;
  organizationId: string;
  organizationName: string;
  role: string;
  settings: OrganizationSettings | null;
};

function deriveOrganizationName(email?: string | null) {
  const localPart = email?.split("@")[0]?.trim();
  if (!localPart) {
    return "Nova Assessoria";
  }

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function ensureUserOrganization(user: User) {
  const serviceSupabase = createServerClient();

  const { data: existingMembership } = await serviceSupabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existingMembership?.organization_id) {
    return existingMembership.organization_id;
  }

  const organizationName = deriveOrganizationName(user.email);

  const { data: organization, error: organizationError } = await serviceSupabase
    .from("organizations")
    .insert({ name: organizationName })
    .select("id")
    .single();

  if (organizationError || !organization) {
    throw new Error(
      `Failed to create organization: ${organizationError?.message || "unknown error"}`
    );
  }

  const organizationId = organization.id as string;

  const { error: memberError } = await serviceSupabase
    .from("organization_members")
    .insert({
      organization_id: organizationId,
      user_id: user.id,
      role: "owner",
    });

  if (memberError) {
    throw new Error(`Failed to create organization membership: ${memberError.message}`);
  }

  const { error: settingsError } = await serviceSupabase
    .from("organization_settings")
    .insert({
      organization_id: organizationId,
      email: user.email || null,
      business_name: organizationName,
      subscription_plan: "free",
      meta_graph_api_version: "v23.0",
      strava_scopes: ["read", "activity:read_all"],
    });

  if (settingsError) {
    throw new Error(`Failed to initialize organization settings: ${settingsError.message}`);
  }

  return organizationId;
}

export async function getCurrentOrganizationContext(): Promise<OrganizationContext> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required");
  }

  await ensureUserOrganization(user);

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (membershipError || !membership) {
    throw new Error(
      `Failed to load organization membership: ${membershipError?.message || "not found"}`
    );
  }

  const organizationMembership = membership as unknown as OrganizationMembershipRow;

  const settingsClient = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServerClient()
    : supabase;

  const { data: settings, error: settingsError } = await settingsClient
    .from("organization_settings")
    .select("*")
    .eq("organization_id", organizationMembership.organization_id)
    .maybeSingle();

  if (settingsError) {
    throw new Error(`Failed to load organization settings: ${settingsError.message}`);
  }

  return {
    user,
    organizationId: organizationMembership.organization_id,
    organizationName: organizationMembership.organizations?.name || "Assessoria",
    role: organizationMembership.role,
    settings: (settings as OrganizationSettings | null) || null,
  };
}

export async function getOrganizationSettingsById(
  organizationId: string
) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("organization_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load organization settings: ${error.message}`);
  }

  return (data as OrganizationSettings | null) || null;
}

export async function getOrganizationSettingsByPhoneNumberId(
  phoneNumberId: string
) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("organization_settings")
    .select("*")
    .eq("meta_phone_number_id", phoneNumberId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load organization settings by phone number: ${error.message}`);
  }

  return (data as OrganizationSettings | null) || null;
}

export async function listOrganizationSettingsWithMeta() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("organization_settings")
    .select("*")
    .not("meta_app_secret", "is", null)
    .not("meta_system_token", "is", null);

  if (error) {
    throw new Error(`Failed to list Meta organization settings: ${error.message}`);
  }

  return (data as OrganizationSettings[]) || [];
}

export async function getConversationOrganizationContext(
  conversationId: string
) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, organization_id, contact_phone, phone_number_id")
    .eq("id", conversationId)
    .single();

  if (error || !data) {
    throw new Error(`Conversation not found: ${error?.message || conversationId}`);
  }

  const settings = await getOrganizationSettingsById(
    data.organization_id as string
  );

  return {
    conversationId: data.id as string,
    organizationId: data.organization_id as string,
    contactPhone: data.contact_phone as string,
    phoneNumberId: (data.phone_number_id as string | null) || null,
    settings,
  };
}

export async function upsertCurrentOrganizationSettings(
  values: Omit<OrganizationSettings, "organization_id">
) {
  const context = await getCurrentOrganizationContext();
  const supabase = await createSupabaseServer();

  const payload = {
    organization_id: context.organizationId,
    ...values,
  };

  const { data, error } = await supabase
    .from("organization_settings")
    .upsert(payload, { onConflict: "organization_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save organization settings: ${error.message}`);
  }

  return data as OrganizationSettings;
}
