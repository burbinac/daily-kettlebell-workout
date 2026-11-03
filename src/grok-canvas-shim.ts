// Stand-in for the "grok/canvas" module the Grok viewer normally provides.
// The app builds its own dark palette (usePalette in App.tsx) and only reads
// font.family and weight.* from the host theme; the rest is a dark fallback.
import { useState, useEffect } from "react";
import type { CSSProperties, ChangeEvent } from "react";

export { useState, useEffect };
export type { CSSProperties, ChangeEvent };

const THEME = {
  font: {
    family: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  edge: "#12151A",
  bg: { page: "none", base: "#12151A", subtle: "#222B36", elevated: "#384453" },
  border: { subtle: "#3A4655", default: "#506074" },
  text: { primary: "#F3F6FA", secondary: "#B7C2D0", tertiary: "#98A5B5", onPrimary: "#0A1420", onColor: "#06201D", accent: "#22D3EE" },
  fill: { primary: "#22D3EE", secondary: "#2F3A47", accent: "#22D3EE" },
  shadow: { card: "0 10px 24px rgba(0,0,0,0.5)", bar: "0 14px 30px rgba(0,0,0,0.65)", float: "0 18px 40px rgba(0,0,0,0.75)" },
  dataviz: { categorical: ["#22D3EE", "#62B4F4", "#A78BFA", "#FBBF24"] },
};

export function useGrokTheme() {
  return THEME;
}
