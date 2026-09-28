import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("styles.css", "utf8");
const rule = (selector: string): string => css.slice(css.indexOf(`\n${selector} {`)).split("}")[0];
const nav = ".veynrel-health-view .veynrel-findings-navigation";

describe("workspace presentation contract", () => {
  it("shares one wide responsive shell, with bounded prose and an out-of-layout live region", () => {
    const shell = rule(".veynrel-health-view .veynrel-workspace");
    expect(shell).toContain("max-width: 1400px;");
    expect(shell).toContain("width: calc(100% - 32px);");
    expect(shell).toContain("margin-inline: auto;");
    expect(shell).toContain("padding-block: 16px;");
    expect(css).toContain(".veynrel-health-view .veynrel-workspace { width: 100%; padding: 12px; }");
    expect(css).toContain("max-width: 80ch;");
    expect(css).not.toMatch(/max-width: (?:880|1120)px/u);
    const live = rule(".veynrel-health-view .veynrel-health-status");
    for (const declaration of ["position: absolute;", "width: 1px;", "height: 1px;", "opacity: 0;", "pointer-events: none;", "overflow: hidden;"])
      expect(live).toContain(declaration);
    expect(live).not.toMatch(/display:\s*none|visibility:\s*hidden/u);
    expect(css).not.toContain(".veynrel-health-status:empty");
  });
  it("uses a flat scrolling rail, transparent buttons, short separators and an accent underline", () => {
    expect(rule(nav)).toContain("flex-wrap: nowrap;");
    expect(rule(nav)).toContain("overflow-x: auto;");
    expect(rule(nav)).toContain("scroll-padding-inline: var(--size-4-2);");
    expect(rule(nav)).toContain("width: 100%;");
    for (const selector of [nav, `${nav} button`, ".veynrel-topology-preview"]) {
      expect(rule(selector)).toContain("border: 0;");
      expect(rule(selector)).toContain("border-radius: 0;");
      expect(rule(selector)).toContain("background: transparent;");
    }
    expect(rule(nav)).toContain("border-bottom: 1px solid var(--background-modifier-border);");
    expect(rule(`${nav} button`)).toContain("flex: 1 0 auto;");
    expect(rule(`${nav} button`)).toContain("white-space: nowrap;");
    expect(rule(`${nav} button + button::before`)).toContain("border-inline-start:");
    expect(rule(`${nav} button:focus-visible`)).toContain("outline:");
    expect(css).toMatch(/\[aria-current="page"\],[^{]+\{[^}]*font-weight: var\(--font-semibold\);[^}]*box-shadow: inset 0 -2px var\(--interactive-accent\);/u);
    expect(css).not.toMatch(/findings-navigation[^{}]*\{[^}]*flex-(?:basis: \d+%|wrap: wrap)/u);
  });

  it("integrates the preview section while retaining the neutral map surface", () => {
    expect(rule(".veynrel-topology-preview")).toContain("border-bottom: 1px solid var(--background-modifier-border);");
    expect(rule(".veynrel-topology-svg")).toContain("background: var(--background-secondary);");
  });
  it("shares theme-owned presentation and disables nonessential motion throughout the workspace", () => {
    const shared = css.split("/* Shared workspace presentation")[1];
    expect(shared).not.toMatch(/#[\da-f]{3,8}\b|\brgba?\(|\bhsla?\(/iu);
    expect(css).not.toMatch(/clip-path|column-gap|!important/u);
    expect(css).not.toMatch(/\.veynrel-(?:workspace|topology-detail|neighborhood|neighborhood-card|global-map)\s+\*/u);
    for (const selector of [".veynrel-health-page-enter", ".veynrel-topology-content", ".veynrel-topology-inspector-content",
      ".veynrel-findings-navigation button", ".veynrel-topology-detail :is(button, input, summary)", ".veynrel-neighborhood-list button",
      ".ai-hub-provider-card", ".ai-hub-model-chip", ".ai-hub-test-btn"])
      expect(css.split("@media (prefers-reduced-motion: reduce)").slice(1).some((block) => block.split("\n}")[0].includes(selector))).toBe(true);
    expect(shared).toContain(".veynrel-semantic-exploration, .veynrel-connect-overview { grid-template-columns: minmax(0, 1fr); }");
    expect(shared).toContain(".veynrel-connections-overview { grid-template-columns: minmax(0, 1fr);");
    expect(css).not.toContain(".veynrel-findings-row-explanation");
  });
});
