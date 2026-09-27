import { describe, expect, it } from "vitest";
import { semanticNeighborhoodLayout, semanticNeighborhoodRadius } from "./semanticNeighborhoodLayout";

describe("deterministic cosine-distance encoding", () => {
  it("visibly separates high and lower similarities on an absolute scale with source clearance", () => {
    expect(semanticNeighborhoodRadius(1)).toBe(100); expect(semanticNeighborhoodRadius(-1)).toBe(410);
    expect(semanticNeighborhoodRadius(0.5) - semanticNeighborhoodRadius(0.9)).toBeGreaterThan(85);
    expect(semanticNeighborhoodRadius(0.8) - semanticNeighborhoodRadius(0.99)).toBeGreaterThan(75);
    const source = { id: "source" }, neighbor = { id: "near", path: "near.md", similarity: 0.9 };
    const radius = (point: { x: number; y: number }) => Math.hypot(point.x - 500, point.y - 500);
    const one = semanticNeighborhoodLayout(source, [neighbor])[1];
    const many = semanticNeighborhoodLayout(source, [neighbor, { id: "far", path: "far.md", similarity: -0.5 }])[1];
    expect(radius(one)).toBeCloseTo(radius(many)); // Other scores never rescale this note.
  });
  it.each([[], [0.9], Array(10).fill(0.5) as number[], [1, 0.999999, 0.9, 0.82, 0.64, 0, -0.1, -0.9, -0.99999, -1]].map((scores) => [scores]))("centers the source with monotonic finite distances: %j", (scores) => {
    const neighbors = scores.map((similarity, i) => ({ id: `${i}`, path: `${i}.md`, similarity }));
    const positions = semanticNeighborhoodLayout({ id: "source" }, neighbors);
    expect(positions).toEqual(semanticNeighborhoodLayout({ id: "source" }, [...neighbors].reverse()));
    expect(positions[0]).toEqual({ id: "source", x: 500, y: 500 });
    expect(positions.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1000 && p.y >= 0 && p.y <= 1000)).toBe(true);
    for (const a of neighbors) for (const b of neighbors) {
      const pa = positions.find((p) => p.id === a.id)!; const pb = positions.find((p) => p.id === b.id)!;
      const da = Math.hypot(pa.x - 500, pa.y - 500); const db = Math.hypot(pb.x - 500, pb.y - 500);
      expect(da).toBeGreaterThanOrEqual(100 - 1e-10); expect(da).toBeLessThanOrEqual(410 + 1e-10);
      if (a.similarity > b.similarity) expect(da).toBeLessThanOrEqual(db + 1e-10);
    }
  });
});
