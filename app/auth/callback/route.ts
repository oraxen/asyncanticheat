import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function getSafeRedirect(redirect: string | null): string {
  const fallback = "/dashboard";
  if (!redirect) return fallback;

  // Must start with single slash (relative path) and not be protocol-relative
  if (!redirect.startsWith("/") || redirect.startsWith("//")) {
    return fallback;
  }

  // Block any URL-encoded slashes that could bypass the check
  if (redirect.includes("%2f") || redirect.includes("%2F")) {
    return fallback;
  }

  return redirect;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirect = getSafeRedirect(searchParams.get("redirect"));

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
