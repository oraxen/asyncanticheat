import type { SlideTheme } from "./slides";

export interface ThemeColors {
  accent: string;
  accentGlow: string;
  accentSoft: string;
  accentBorder: string;
  accentLine: string;
  accentGlowOuter: string;
  panelShadow: string;
  textColor: string;
  panelA: string;
  panelB: string;
  panelC: string;
  bgBrightness: number;
  vignetteStrength: number;
}

export const themes: Record<SlideTheme, ThemeColors> = {
  indigo: {
    accent: "#6366f1",
    accentGlow: "rgba(99, 102, 241, 0.6)",
    accentSoft: "rgba(99, 102, 241, 0.16)",
    accentBorder: "rgba(99, 102, 241, 0.5)",
    accentLine: "rgba(99, 102, 241, 0.3)",
    accentGlowOuter: "rgba(99, 102, 241, 0.4)",
    panelShadow: "rgba(99, 102, 241, 0.1)",
    textColor: "rgba(236, 240, 255, 0.97)",
    panelA: "rgba(16, 14, 36, 0.96)",
    panelB: "rgba(20, 18, 44, 0.93)",
    panelC: "rgba(14, 12, 34, 0.9)",
    bgBrightness: 0.9,
    vignetteStrength: 0.26,
  },
};

/** Convert theme to CSS custom properties for inline styles */
export function getThemeStyles(theme: SlideTheme): React.CSSProperties {
  const t = themes[theme];
  return {
    "--slide-accent": t.accent,
    "--slide-accent-glow": t.accentGlow,
    "--slide-accent-soft": t.accentSoft,
    "--slide-accent-border": t.accentBorder,
    "--slide-accent-line": t.accentLine,
    "--slide-accent-glow-outer": t.accentGlowOuter,
    "--slide-panel-shadow": t.panelShadow,
    "--slide-text-color": t.textColor,
    "--slide-panel-a": t.panelA,
    "--slide-panel-b": t.panelB,
    "--slide-panel-c": t.panelC,
    "--slide-bg-brightness": t.bgBrightness,
    "--slide-vignette-strength": t.vignetteStrength,
  } as React.CSSProperties;
}
