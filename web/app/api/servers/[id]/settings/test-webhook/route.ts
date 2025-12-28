import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
}

interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
}

interface GenericWebhookPayload {
  type: "test";
  source: "asyncanticheat";
  server_id: string;
  message: string;
  timestamp: string;
}

function isDiscordWebhook(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "discord.com" && parsed.pathname.startsWith("/api/webhooks/");
  } catch {
    return false;
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  const { id: serverId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Optional: allow testing with a URL from request body (for testing before saving)
  let webhookUrl: string | null = null;
  try {
    const body = await req.json();
    webhookUrl = body?.webhook_url ?? null;
  } catch {
    // No body is fine
  }

  const admin = createAdminClient();

  // Verify ownership and get webhook URL if not provided
  const { data: server, error: findError } = await admin
    .from("servers")
    .select("id,name,owner_user_id,webhook_url")
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

  // Use provided URL or fall back to saved URL
  const targetUrl = webhookUrl || server.webhook_url;

  if (!targetUrl) {
    return NextResponse.json({ ok: false, error: "no_webhook_url" }, { status: 400 });
  }

  // Validate URL format
  try {
    new URL(targetUrl);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_webhook_url" }, { status: 400 });
  }

  // Build payload based on webhook type
  let payload: DiscordWebhookPayload | GenericWebhookPayload;
  const timestamp = new Date().toISOString();

  if (isDiscordWebhook(targetUrl)) {
    payload = {
      embeds: [
        {
          title: "🛡️ AsyncAnticheat Test",
          description: "This is a test notification from AsyncAnticheat. If you see this, your webhook is configured correctly!",
          color: 0x6366f1, // Indigo
          fields: [
            {
              name: "Server",
              value: server.name || `Server ${serverId.slice(0, 8)}`,
              inline: true,
            },
            {
              name: "Status",
              value: "✅ Connected",
              inline: true,
            },
          ],
          footer: {
            text: "AsyncAnticheat Dashboard",
          },
          timestamp,
        },
      ],
    };
  } else {
    payload = {
      type: "test",
      source: "asyncanticheat",
      server_id: serverId,
      message: "This is a test notification from AsyncAnticheat. Your webhook is configured correctly!",
      timestamp,
    };
  }

  // Send the webhook
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error: "webhook_failed",
          details: `HTTP ${response.status}: ${text.slice(0, 200)}`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "webhook_error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}
