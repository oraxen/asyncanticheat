import type { ReactNode } from "react";
import { Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";

// Custom logo component
function Logo() {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 6,
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ color: "white", fontSize: 12, fontWeight: 600 }}>A</span>
      </div>
      <span style={{ fontWeight: 500 }}>AsyncAnticheat Docs</span>
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
      footer={null}
    >
      {children}
    </Layout>
  );
}
