import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Head } from "nextra/components";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://asyncanticheat.com"),
  title: {
    default: "AsyncAnticheat",
    template: "%s | AsyncAnticheat",
  },
  description: "AsyncAnticheat: Cloud-powered cheat detection for Minecraft servers",
  applicationName: "AsyncAnticheat",
  generator: "Next.js",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AsyncAnticheat",
  },
  formatDetection: {
    telephone: false,
  },
  twitter: {
    card: "summary_large_image",
    site: "@asyncanticheat",
    creator: "@asyncanticheat",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "AsyncAnticheat",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head>
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <body className="min-h-dvh bg-mesh-subtle">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
