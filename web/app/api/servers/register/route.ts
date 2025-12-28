import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Body = {
  token?: string;
  name?: string;
};

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const token = (body.token ?? "").trim();
  const name = (body.name ?? "").trim();

  if (!token) {
    return NextResponse.json({ ok: false, error: "token_required" }, { status: 400 });
  }
  if (token.length > 2048) {
    return NextResponse.json({ ok: false, error: "token_too_long" }, { status: 400 });
  }

  const tokenHash = sha256Hex(token);
  const admin = createAdminClient();

  const { data: server, error: findError } = await admin
    .from("servers")
    .select("id,owner_user_id,registered_at,name")
    .eq("auth_token_hash", tokenHash)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ ok: false, error: findError.message }, { status: 500 });
  }

  if (!server) {
    // The plugin hasn't contacted the API yet (handshake/ingest), so there's nothing to claim.
    return NextResponse.json(
      { ok: false, error: "server_not_seen_yet" },
      { status: 404 }
    );
  }

  if (server.owner_user_id && server.owner_user_id !== user.id) {
    return NextResponse.json(
      { ok: false, error: "already_registered" },
      { status: 409 }
    );
  }

  const update: Record<string, unknown> = {
    owner_user_id: user.id,
    registered_at: new Date().toISOString(),
  };

  // Only set name if the server doesn't already have one.
  if (name && !server.name) {
    update.name = name;
  }

  const { data: updated, error: updateError } = await admin
    .from("servers")
    .update(update)
    .eq("id", server.id)
    .select("id,name,platform,last_seen_at")
    .single();

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, server: updated });
}

