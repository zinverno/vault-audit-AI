import { describe, expect, it, vi } from "vitest";
import { bindGraphViewport } from "./bindGraphViewport";
import { fitGraph } from "./graphViewport";

describe("shared graph pointer lifecycle", () => {
  it("uses screen coordinates, clamps zoom, suppresses drag selection, and releases capture/listeners", () => {
    const listeners = new Map<string, (event: unknown) => void>(); let captured: number | undefined;
    const svg = { addEventListener: (name: string, fn: (event: unknown) => void) => listeners.set(name, fn),
      removeEventListener: (name: string) => listeners.delete(name), getScreenCTM: () => ({ inverse: () => ({}) }),
      createSVGPoint: () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } }),
      setPointerCapture: (id: number) => { captured = id; }, hasPointerCapture: (id: number) => captured === id,
      releasePointerCapture: () => { captured = undefined; } };
    const state = { viewport: fitGraph() }; const update = vi.fn(), select = vi.fn();
    const dispose = bindGraphViewport(svg as unknown as SVGSVGElement, state, update, "data-node", select);
    const event = { pointerId: 1, clientX: 100, clientY: 100, button: 0, target: { closest: () => ({ getAttribute: () => "id-123" }) } };
    listeners.get("pointerdown")!(event); listeners.get("pointerup")!({ ...event, clientX: 103 });
    expect(select).toHaveBeenCalledWith("id-123"); expect(captured).toBeUndefined(); select.mockClear();
    listeners.get("pointerdown")!(event); listeners.get("pointermove")!({ ...event, clientX: 130 }); listeners.get("pointerup")!(event);
    expect(state.viewport.x).toBe(30); expect(select).not.toHaveBeenCalled();
    listeners.get("pointerdown")!(event); listeners.get("pointerup")!({ ...event, clientX: 130 }); expect(select).not.toHaveBeenCalled();
    listeners.get("pointerdown")!(event); listeners.get("pointercancel")!(event); expect(captured).toBeUndefined();
    const preventDefault = vi.fn(); for (let i = 0; i < 20; i++) listeners.get("wheel")!({ ...event, deltaMode: 0, deltaY: -1000, preventDefault });
    expect(state.viewport.zoom).toBe(4); expect(preventDefault).toHaveBeenCalledTimes(20);
    listeners.get("pointerdown")!(event); dispose(); expect(captured).toBeUndefined(); expect(listeners.size).toBe(0);
  });
});
