import { describe, expect, it } from "vitest";
import type { SemanticGlobalMap } from "../semanticGlobalMapPort";
import { semanticCoreRadius, semanticFocusLayout, semanticGlobalMapLayout, semanticNodeRadius, semanticScoreSummary } from "./semanticGlobalMapLayout";
import { semanticGraphLabel, separateSemanticLabels } from "./semanticGraphLabel";
function fixture(bridge: boolean): SemanticGlobalMap {
  return { revision: { vectorGeneration: 1, vectorCount: 6, dimensions: 3, provider: "test", model: "test", configurationRevision: 0, runtimeRevision: 0 },
    indexedNoteCount: 6, mappedNoteCount: 6, capturedAt: 0,
    nodes: ["A", "B", "C", "D", "E", "F"].map((name, i) => ({ id: name + ".md", path: name + ".md", basename: name,
      coreSimilarity: 1 - i * 0.4, semanticConnectedness: 0.9 - i * 0.1, neighbors: [] })),
    edges: [["A", "B", 0.99], ["B", "C", 0.98], ["A", "C", 0.97], ["D", "E", 0.99], ["E", "F", 0.98], ["D", "F", 0.97],
      ...(bridge ? [["C", "D", 0.01]] : [])].map(([left, right, score]) => ({ left: left + ".md", right: right + ".md", score: Number(score), mutual: true })) };
}
describe("deterministic semantic angular forest", () => {
  it("changes only radii on focus, centers the note, and restores exact core coordinates on reset", () => {
    const map = fixture(true), original = JSON.stringify(map), core = semanticGlobalMapLayout(map);
    const focus = { path: "C.md", scores: map.nodes.map((n, i) => ({ path: n.path, score: n.path === "C.md" ? 1 : -1 + i * 0.35 })) };
    const points = semanticFocusLayout(core, focus);
    const center = points.find(p => p.path === focus.path)!;
    expect(center).toMatchObject({ x: 500, y: 500, distance: 0 });
    for (const [i, point] of points.entries()) {
      expect([point.angle, point.sectorStart, point.sectorEnd, point.radius]).toEqual([core[i].angle, core[i].sectorStart, core[i].sectorEnd, core[i].radius]);
      if (point !== center) expect(point.distance).toBe(semanticCoreRadius(focus.scores[i].score));
      for (const [j, other] of points.entries()) if (focus.scores[i].score > focus.scores[j].score) expect(point.distance).toBeLessThanOrEqual(other.distance);
    }
    expect(points).not.toEqual(core); expect(semanticFocusLayout(core)).toBe(core); expect(JSON.stringify(map)).toBe(original);
  });
  it.each([false, true])("preserves fixed semantic radii, bounds, sizes and contiguous strong branches (bridge %s)", (bridge) => {
    const map = fixture(bridge); const positions = semanticGlobalMapLayout(map);
    expect(positions).toEqual(semanticGlobalMapLayout(map));
    expect(positions).toEqual(semanticGlobalMapLayout({ ...map, nodes: [...map.nodes].reverse(), edges: [...map.edges].reverse() }));
    for (const [i, point] of positions.entries()) {
      expect([point.x, point.y, point.angle, point.radius, point.distance].every(Number.isFinite)).toBe(true);
      expect(point.x).toBeGreaterThanOrEqual(90); expect(point.x).toBeLessThanOrEqual(910);
      expect(point.y).toBeGreaterThanOrEqual(90); expect(point.y).toBeLessThanOrEqual(910);
      expect(Math.hypot(point.x - 500, point.y - 500)).toBeCloseTo(semanticCoreRadius(map.nodes[i].coreSimilarity), 10);
      expect(point.radius).toBeGreaterThanOrEqual(4); expect(point.radius).toBeLessThanOrEqual(14);
      if (i) { expect(point.distance).toBeGreaterThanOrEqual(positions[i - 1].distance); expect(point.radius).toBeLessThanOrEqual(positions[i - 1].radius); }
    }
    const order = [...positions].sort((a, b) => a.angle - b.angle).map((p) => p.path);
    expect(order).toEqual(["A.md", "B.md", "C.md", "D.md", "E.md", "F.md"]);
    const subtree = positions.find((p) => p.path === "D.md")!;
    for (const child of positions.filter((p) => ["E.md", "F.md"].includes(p.path))) {
      expect(child.angle).toBeGreaterThan(subtree.sectorStart); expect(child.angle).toBeLessThan(subtree.sectorEnd);
    }
  });
  it.each([20, 650, 980])("separates crowded labels, including map boundaries at %s", (y) => {
    const labels = Array.from({ length: 6 }, (_, i) => ({ path: String(i), text: "Nearby semantic note", width: 250, x: 300, y: y + i, anchor: "end" }));
    const original = JSON.stringify(labels);
    const positions = separateSemanticLabels(labels);
    expect(positions).toEqual(separateSemanticLabels(labels));
    for (const a of positions) {
      expect(a.y).toBeGreaterThanOrEqual(20); expect(a.y).toBeLessThanOrEqual(980);
      expect(a.right - a.left).toBe(250);
      for (const b of positions) if (a !== b) expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(28);
    }
    expect(JSON.stringify(labels)).toBe(original);
  });
  it("keeps label text clear of scale and core annotations", () => {
    const [position] = separateSemanticLabels([{ path: "a", text: "A", x: 500, y: 368, anchor: "middle" }], [{ left: 478, right: 522, top: 356, bottom: 380 }]);
    expect(Math.abs(position.y - 368)).toBeGreaterThanOrEqual(28);
  });
  it("uses absolute cosine and bounded connectedness, not rank", () => {
    expect(semanticCoreRadius(1)).toBe(120); expect(semanticCoreRadius(-1)).toBe(410);
    expect(semanticCoreRadius(0.81) - semanticCoreRadius(0.82)).toBeCloseTo(1.45);
    expect(semanticNodeRadius(-1)).toBe(4); expect(semanticNodeRadius(1)).toBe(14); expect(semanticNodeRadius(null)).toBe(4);
    // Distinct common positive scores now differ by >4 units, previously just 1.
    expect(semanticNodeRadius(0.9) - semanticNodeRadius(0.5)).toBeGreaterThan(4);
    for (let i = 1; i <= 100; i++) expect(semanticNodeRadius(-1 + i / 50)).toBeGreaterThanOrEqual(semanticNodeRadius(-1 + (i - 1) / 50));
  });
  it("derives ranges and medians from captured scores without changing inputs", () => {
    const scores = Object.freeze([0.9, -0.2, 0.1, 0.5]);
    expect(semanticScoreSummary(scores)).toEqual({ min: -0.2, max: 0.9, median: 0.3 });
    expect(semanticScoreSummary([0.9, null, -0.2, 0.1])).toEqual({ min: -0.2, max: 0.9, median: 0.1 });
    expect(semanticScoreSummary([1])).toEqual({ min: 1, max: 1, median: 1 });
    expect(semanticScoreSummary([null])).toBeUndefined(); expect(semanticScoreSummary([])).toBeUndefined();
  });
  it("separates even 500 identical high-similarity nodes at 24x with fixed-size markers, preserving domain values", () => {
    const base = fixture(true);
    const nodes = Array.from({ length: 500 }, (_, i) => ({ ...base.nodes[0], id: `${i}.md`, path: `${i}.md`, coreSimilarity: 1, semanticConnectedness: 1 }));
    const map = { ...base, nodes, edges: [], mappedNoteCount: 500, indexedNoteCount: 500 }, before = JSON.stringify(map);
    const layout = semanticGlobalMapLayout(map);
    expect(layout).toEqual(semanticGlobalMapLayout(map));
    for (let i = 0; i < layout.length; i++) for (let j = i + 1; j < layout.length; j++) {
      const a = layout[i], b = layout[j];
      expect(Math.hypot(a.x - b.x, a.y - b.y) * 24).toBeGreaterThan(a.radius + b.radius);
    }
    expect(JSON.stringify(map)).toBe(before);
  });
  it("places labels radially without moving nodes", () => {
    expect(semanticGraphLabel({ x: 500, y: 500 }, 35)).toEqual({ x: 500, y: 447, anchor: "middle" });
    expect(semanticGraphLabel({ x: 700, y: 500 }, 18)).toEqual({ x: 730, y: 500, anchor: "start" });
    expect(semanticGraphLabel({ x: 300, y: 500 }, 18)).toEqual({ x: 270, y: 500, anchor: "end" });
    expect(semanticGraphLabel({ x: 500, y: 300 }, 18)).toEqual({ x: 500, y: 270, anchor: "middle" });
  });
});
