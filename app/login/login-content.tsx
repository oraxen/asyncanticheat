"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { RiGithubFill, RiDiscordFill, RiMailLine } from "@remixicon/react";

export function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const error = searchParams.get("error");
  const supabase = createClient();

  // Check if user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        router.push("/dashboard");
      }
    };
    checkUser();
  }, [router, supabase.auth]);

  // Check if email exists when user finishes typing
  useEffect(() => {
    const checkEmail = async () => {
      if (!email || !email.includes("@")) {
        setShowPassword(false);
        return;
      }

      setCheckingEmail(true);
      try {
        // Try to sign in with dummy password to check if user exists with password
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: "check_if_exists_dummy_password_that_will_fail",
        });

        // If error is "Invalid login credentials", user exists with password
        if (
          error?.message?.includes("Invalid login credentials") ||
          error?.message?.includes("Email not confirmed")
        ) {
          setShowPassword(true);
        } else {
          setShowPassword(false);
        }
      } catch {
        setShowPassword(false);
      }
      setCheckingEmail(false);
    };

    const timer = setTimeout(checkEmail, 500);
    return () => clearTimeout(timer);
  }, [email, supabase.auth]);

  const handleOAuth = async (provider: "github" | "discord") => {
    setLoading(true);
    setMessage(null);

    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=/dashboard`,
      },
    });
  };

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // If password is shown and filled, try password auth
    if (showPassword && password) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage({ type: "error", text: error.message });
        setLoading(false);
      } else {
        router.push("/dashboard");
      }
      return;
    }

    // Otherwise, send magic link
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?redirect=/dashboard`,
      },
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
      setLoading(false);
    } else {
      setMessage({ type: "success", text: "Check your email for a magic link" });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen surface-0 flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(99, 102, 241, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(99, 102, 241, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="glass-panel rounded-2xl p-8 animate-fade-in">
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500">
                <span className="text-lg font-semibold text-white">A</span>
              </div>
            </Link>
            <h1 className="text-xl font-semibold text-[rgb(var(--foreground))]">
              Sign in to Dashboard
            </h1>
            <p className="mt-2 text-sm text-[rgb(var(--foreground-secondary))]">
              Connect with your account to access the dashboard
            </p>
          </div>

          {/* Error messages */}
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error === "auth_failed" || error === "access_denied"
                ? "Authentication failed. Please try again."
                : error === "server_error"
                  ? "Something went wrong. Please try again later."
                  : "An error occurred. Please try again."}
            </div>
          )}
          {message && message.type === "error" && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {message.text}
            </div>
          )}

          {/* Success message */}
          {message?.type === "success" && message.text.includes("email") ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 mb-4">
                <RiMailLine className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-medium text-[rgb(var(--foreground))]">
                Check your email
              </h2>
              <p className="mt-2 text-sm text-[rgb(var(--foreground-secondary))]">
                We sent you a magic link to sign in.
              </p>
            </div>
          ) : (
            <>
              {/* OAuth buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => handleOAuth("github")}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-[#24292e] hover:bg-[#2f363d] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RiGithubFill className="w-5 h-5" />
                  Continue with GitHub
                </button>
                <button
                  onClick={() => handleOAuth("discord")}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RiDiscordFill className="w-5 h-5" />
                  Continue with Discord
                </button>
              </div>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[rgb(var(--border))]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 surface-0 text-[rgb(var(--foreground-tertiary))]">
                    or use email
                  </span>
                </div>
              </div>

              {/* Email form */}
              <form onSubmit={handleEmailLogin} className="space-y-3">
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full px-4 py-3 rounded-lg surface-1 border border-[rgb(var(--border))] text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--foreground-muted))] text-sm focus:border-indigo-500/50 focus:outline-none transition-colors"
                />
                {showPassword && (
                  <input
                    type="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    autoFocus
                    className="w-full px-4 py-3 rounded-lg surface-1 border border-[rgb(var(--border))] text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--foreground-muted))] text-sm focus:border-indigo-500/50 focus:outline-none transition-colors animate-slide-up"
                  />
                )}
                <button
                  type="submit"
                  disabled={loading || checkingEmail}
                  className="w-full px-4 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? "Sending..."
                    : showPassword && password
                      ? "Sign in"
                      : "Send magic link"}
                </button>
              </form>
            </>
          )}

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-[rgb(var(--foreground-muted))]">
            By signing in, you agree to our terms of service
          </p>
        </div>

        {/* Back to home */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-[rgb(var(--foreground-tertiary))] hover:text-[rgb(var(--foreground-secondary))] transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
