import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "AsyncAnticheat",
  description: "AsyncAnticheat – server-owner dashboard for async checks, findings and analytics."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-mesh-subtle">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}


