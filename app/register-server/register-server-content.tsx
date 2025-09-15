"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const TOKEN_STORAGE_KEY = "aac_register_token_v1";

function safeRedirectPath(p: string | null): string {
  if (!p) return "/dashboard";
  if (!p.startsWith("/") || p.startsWith("//")) return "/dashboard";
  if (p.includes("%2f") || p.includes("%2F")) return "/dashboard";
  return p;
}

export function RegisterServerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [userReady, setUserReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<
    | { type: "idle" }
    | { type: "loading" }
    | { type: "error"; message: string }
    | { type: "success"; message: string }
  >({ type: "idle" });

  // Capture token from URL -> sessionStorage (so we don't lose it through login redirects).
  useEffect(() => {
    const fromUrl = searchParams.get("token")?.trim() || "";
    if (fromUrl) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, fromUrl);
      setToken(fromUrl);
      // Remove token from URL (avoid referrer leaks / sharing).
      router.replace("/register-server");
      return;
    }

    const stored = sessionStorage.getItem(TOKEN_STORAGE_KEY) || "";
    if (stored && !token) {
      setToken(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check logged-in state.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setIsLoggedIn(!!user);
      setUserReady(true);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [supabase.auth]);

  const loginHref = useMemo(() => {
    // Include the token in the redirect URL so it survives the OAuth flow
    const t = token.trim();
    const redirect = t 
      ? `/register-server?token=${encodeURIComponent(t)}`
      : "/register-server";
    return `/login?redirect=${encodeURIComponent(redirect)}`;
  }, [token]);

  async function onRegister() {
    const t = token.trim();
    if (!t) {
      setStatus({ type: "error", message: "Paste the server token first." });
      return;
    }

    setStatus({ type: "loading" });
    try {
      const res = await fetch("/api/servers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t, name: name.trim() || undefined }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };

      if (!res.ok || !json.ok) {
        const e = json.error || `HTTP ${res.status}`;
        if (e === "server_not_seen_yet") {
          throw new Error(
            "Server not seen yet. Start your server once so the plugin can contact the API, then try again."
          );
        }
        if (e === "already_registered") {
          throw new Error("This server is already linked to another account.");
        }
        throw new Error(e);
      }

      setStatus({
        type: "success",
        message: "Server linked successfully. Redirecting to dashboard…",
      });
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      setTimeout(() => router.push("/dashboard"), 600);
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Registration failed",
      });
    }
  }

  return (
    <div className="min-h-screen surface-0 flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg glass-panel rounded-2xl p-8 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">Link a server</h1>
          <p className="mt-2 text-sm text-white/50">
            Paste the token printed by the AsyncAnticheat plugin to link this
            server to your dashboard account.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-white/60 block mb-1.5">
              Server token
            </label>
            <input
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                sessionStorage.setItem(TOKEN_STORAGE_KEY, e.target.value);
              }}
              placeholder="Paste token from server console / /aac"
              className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono"
            />
            <p className="mt-1 text-[11px] text-white/35">
              Tip: run <span className="font-mono">/aac</span> on your server to
              show the link again.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-white/60 block mb-1.5">
              Optional name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Minecraft Server"
              className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>

          {status.type === "error" && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {status.message}
            </div>
          )}
          {status.type === "success" && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-sm">
              {status.message}
            </div>
          )}

          {!userReady ? (
            <button
              disabled
              className="w-full px-4 py-3 rounded-lg bg-white/[0.06] text-white/40 text-sm font-medium"
            >
              Loading…
            </button>
          ) : !isLoggedIn ? (
            <Link
              href={loginHref}
              className="block w-full text-center px-4 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors"
            >
              Sign in to link this server
            </Link>
          ) : (
            <button
              onClick={onRegister}
              disabled={status.type === "loading"}
              className="w-full px-4 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status.type === "loading" ? "Linking…" : "Link server"}
            </button>
          )}

          <div className="pt-2 text-center">
            <Link
              href="/dashboard"
              className="text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              ← Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

