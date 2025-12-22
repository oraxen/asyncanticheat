import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export interface ServerSettings {
  webhook_url: string | null;
  webhook_enabled: boolean;
  webhook_severity_levels: string[];
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { id: serverId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: server, error } = await admin
    .from("servers")
    .select("id,owner_user_id,webhook_url,webhook_enabled,webhook_severity_levels")
    .eq("id", serverId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!server) {
    return NextResponse.json({ ok: false, error: "server_not_found" }, { status: 404 });
  }

  if (server.owner_user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });
  }

  const settings: ServerSettings = {
    webhook_url: server.webhook_url ?? null,
    webhook_enabled: server.webhook_enabled ?? false,
    webhook_severity_levels: server.webhook_severity_levels ?? ["critical", "high"],
  };

  return NextResponse.json({ ok: true, settings });
}

type UpdateBody = Partial<{
  webhook_url: string | null;
  webhook_enabled: boolean;
  webhook_severity_levels: string[];
}>;

export async function PATCH(req: Request, { params }: RouteParams) {
  const { id: serverId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify ownership
  const { data: server, error: findError } = await admin
    .from("servers")
    .select("id,owner_user_id")
    .eq("id", serverId)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ ok: false, error: findError.message }, { status: 500 });
  }

  if (!server) {
    return NextResponse.json({ ok: false, error: "server_not_found" }, { status: 404 });
  }

  if (server.owner_user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });
  }

  // Build update object with only allowed fields
  const update: Record<string, unknown> = {};

  if (body.webhook_url !== undefined) {
    // Validate webhook URL format if provided
    if (body.webhook_url !== null && body.webhook_url !== "") {
      try {
        new URL(body.webhook_url);
      } catch {
        return NextResponse.json({ ok: false, error: "invalid_webhook_url" }, { status: 400 });
      }
    }
    update.webhook_url = body.webhook_url || null;
  }

  if (body.webhook_enabled !== undefined) {
    update.webhook_enabled = Boolean(body.webhook_enabled);
  }

  if (body.webhook_severity_levels !== undefined) {
    const validLevels = ["critical", "high", "medium", "low"];
    const levels = body.webhook_severity_levels.filter((l) => validLevels.includes(l));
    update.webhook_severity_levels = levels;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: "no_fields_to_update" }, { status: 400 });
  }

  const { error: updateError } = await admin
    .from("servers")
    .update(update)
    .eq("id", serverId);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
