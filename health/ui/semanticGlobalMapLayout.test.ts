import { describe, expect, it } from "vitest";
import type { SemanticGlobalMap } from "../semanticGlobalMapPort";
import { semanticCoreRadius, semanticGlobalMapLayout, semanticNodeRadius } from "./semanticGlobalMapLayout";
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
  it.each([false, true])("preserves fixed semantic radii, bounds, sizes and contiguous strong branches (bridge %s)", (bridge) => {
    const map = fixture(bridge); const positions = semanticGlobalMapLayout(map);
    expect(positions).toEqual(semanticGlobalMapLayout(map));
    expect(positions).toEqual(semanticGlobalMapLayout({ ...map, nodes: [...map.nodes].reverse(), edges: [...map.edges].reverse() }));
    for (const [i, point] of positions.entries()) {
      expect([point.x, point.y, point.angle, point.radius, point.distance].every(Number.isFinite)).toBe(true);
      expect(point.x).toBeGreaterThanOrEqual(90); expect(point.x).toBeLessThanOrEqual(910);
      expect(point.y).toBeGreaterThanOrEqual(90); expect(point.y).toBeLessThanOrEqual(910);
      expect(Math.hypot(point.x - 500, point.y - 500)).toBeCloseTo(semanticCoreRadius(map.nodes[i].coreSimilarity), 10);
      expect(point.radius).toBeGreaterThanOrEqual(4); expect(point.radius).toBeLessThanOrEqual(9);
      if (i) { expect(point.distance).toBeGreaterThanOrEqual(positions[i - 1].distance); expect(point.radius).toBeLessThanOrEqual(positions[i - 1].radius); }
    }
    const order = [...positions].sort((a, b) => a.angle - b.angle).map((p) => p.path);
    expect(order).toEqual(["A.md", "B.md", "C.md", "D.md", "E.md", "F.md"]);
    const subtree = positions.find((p) => p.path === "D.md")!;
    for (const child of positions.filter((p) => ["E.md", "F.md"].includes(p.path))) {
      expect(child.angle).toBeGreaterThan(subtree.sectorStart); expect(child.angle).toBeLessThan(subtree.sectorEnd);
    }
  });
  it("keeps adjacent permanent labels readable without changing nodes", () => {
    const labels = Array.from({ length: 6 }, (_, i) => ({ path: String(i), text: "Nearby semantic note", x: 300, y: 650 + i, anchor: "end" }));
    const positions = separateSemanticLabels(labels);
    expect(positions).toEqual(separateSemanticLabels(labels));
    for (let i = 1; i < positions.length; i++) expect(positions[i].y - positions[i - 1].y).toBeGreaterThanOrEqual(24);
    expect(labels[0].y).toBe(650);
  });
  it("uses absolute cosine and bounded connectedness, not rank", () => {
    expect(semanticCoreRadius(1)).toBe(120); expect(semanticCoreRadius(-1)).toBe(410);
    expect(semanticCoreRadius(0.81) - semanticCoreRadius(0.82)).toBeCloseTo(1.45);
    expect(semanticNodeRadius(-1)).toBe(4); expect(semanticNodeRadius(1)).toBe(9); expect(semanticNodeRadius(null)).toBe(4);
  });
  it("places labels radially without moving nodes", () => {
    expect(semanticGraphLabel({ x: 500, y: 500 }, 35)).toEqual({ x: 500, y: 447, anchor: "middle" });
    expect(semanticGraphLabel({ x: 700, y: 500 }, 18)).toEqual({ x: 730, y: 500, anchor: "start" });
    expect(semanticGraphLabel({ x: 300, y: 500 }, 18)).toEqual({ x: 270, y: 500, anchor: "end" });
    expect(semanticGraphLabel({ x: 500, y: 300 }, 18)).toEqual({ x: 500, y: 270, anchor: "middle" });
  });
});
