import { useMDXComponents as getDocsMDXComponents } from "nextra-theme-docs";
import type { ComponentType, ReactNode } from "react";

const docsComponents = getDocsMDXComponents();

// Custom card component for feature highlights
function FeatureCard({
  title,
  children,
  icon,
}: {
  title: string;
  children: ReactNode;
  icon?: string;
}) {
  return (
    <div
      style={{
        padding: "1.25rem",
        borderRadius: "0.75rem",
        backgroundColor: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        marginBottom: "1rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        {icon && <span style={{ fontSize: "1.25rem" }}>{icon}</span>}
        <h4 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "white" }}>
          {title}
        </h4>
      </div>
      <div style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "0.875rem" }}>{children}</div>
    </div>
  );
}

// Custom stat display component
function Stat({ label, value, suffix }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div
      style={{
        padding: "1rem",
        borderRadius: "0.75rem",
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontSize: "0.625rem",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "rgb(129, 140, 248)", // Indigo-400
          marginBottom: "0.25rem",
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: "1.5rem",
          fontWeight: 300,
          color: "white",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
        {suffix && (
          <span style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.5)", marginLeft: "0.125rem" }}>
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}

// Custom badge/tag component
function Badge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "error";
}) {
  const colors = {
    default: { bg: "rgba(99, 102, 241, 0.1)", text: "rgb(129, 140, 248)" },
    success: { bg: "rgba(34, 197, 94, 0.1)", text: "rgb(74, 222, 128)" },
    warning: { bg: "rgba(234, 179, 8, 0.1)", text: "rgb(250, 204, 21)" },
    error: { bg: "rgba(239, 68, 68, 0.1)", text: "rgb(248, 113, 113)" },
  };
  const { bg, text } = colors[variant];

  return (
    <span
      style={{
        display: "inline-flex",
        padding: "0.25rem 0.625rem",
        borderRadius: "0.375rem",
        fontSize: "0.625rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        backgroundColor: bg,
        color: text,
      }}
    >
      {children}
    </span>
  );
}

export const useMDXComponents = (components?: Record<string, unknown>) => ({
  ...docsComponents,
  // Custom components for AsyncAnticheat docs
  FeatureCard,
  Stat,
  Badge,
  ...(components || {}),
});
