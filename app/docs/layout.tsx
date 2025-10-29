import type { ReactNode } from "react";
import { Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";
import "./docs.css";

// Custom logo component - matches dashboard sidebar design
function Logo() {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: "rgb(99, 102, 241)", // Indigo-500
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "white", fontSize: 12, fontWeight: 700 }}>A</span>
      </div>
      <span
        style={{
          fontWeight: 600,
          fontSize: 14,
          color: "rgba(255, 255, 255, 0.95)",
        }}
      >
        AsyncAnticheat
      </span>
    </div>
  );
}

export default async function DocsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const navbar = (
    <Navbar
      logo={<Logo />}
      logoLink="/docs"
      projectLink="https://github.com/oraxen/asyncanticheat"
      chatLink="https://discord.gg/asyncanticheat"
    />
  );
  // Get only the docs page map
  const pageMap = await getPageMap("/docs");
  return (
    <Layout
      navbar={navbar}
      editLink="Edit this page on GitHub"
      docsRepositoryBase="https://github.com/oraxen/asyncanticheat/blob/main/async_anticheat_website"
      sidebar={{ defaultMenuCollapseLevel: 1 }}
      pageMap={pageMap}
      footer={<DocsFooter />}
    >
      {children}
    </Layout>
  );
}

// Minimal footer matching dashboard aesthetic
function DocsFooter() {
  return (
    <div
      style={{
        padding: "1.5rem 0",
        marginTop: "2rem",
        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "0.75rem",
        color: "rgba(255, 255, 255, 0.3)",
      }}
    >
      <span>AsyncAnticheat v0.1.0</span>
      <a
        href="/dashboard"
        style={{
          color: "rgb(99, 102, 241)",
          textDecoration: "none",
          transition: "color 150ms ease",
        }}
      >
        Go to Dashboard →
      </a>
    </div>
  );
}
