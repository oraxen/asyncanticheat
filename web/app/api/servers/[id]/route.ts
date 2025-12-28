import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const { id: serverId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Verify the user owns this server
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

  // Delete the server (cascades to related tables)
  const { error: deleteError } = await admin
    .from("servers")
    .delete()
    .eq("id", serverId);

  if (deleteError) {
    return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
