/** Text outside a node in its radial direction. No geometry changes for labels. */
export function semanticGraphLabel(point: { x: number; y: number }, radius: number) {
  const dx = point.x - 500; const dy = point.y - 500; const distance = Math.hypot(dx, dy);
  if (distance < 1) return { x: point.x, y: point.y - radius - 18, anchor: "middle" };
  const ux = dx / distance; const uy = dy / distance;
  return { x: point.x + ux * (radius + 12), y: point.y + uy * (radius + 12),
    anchor: Math.abs(ux) < 0.25 ? "middle" : ux > 0 ? "start" : "end" };
}
export const semanticGraphBasename = (basename: string, limit = 22): string => {
  const characters = Array.from(basename);
  return characters.length > limit ? characters.slice(0, limit - 1).join("") + "…" : basename;
};

/** At most six permanent global labels. Try nearest free rows in both directions,
 * including at map boundaries. Only text moves; node geometry is untouched. */
export function separateSemanticLabels(labels: readonly { path: string; text: string; width?: number; x: number; y: number; anchor: string }[],
  obstacles: readonly { left: number; right: number; top: number; bottom: number }[] = []) {
  const boxes = [...obstacles];
  return labels.map((label) => {
    const width = label.width || Array.from(label.text).length * 12;
    const left = Math.max(16, Math.min(984 - width, label.x - (label.anchor === "end" ? width : label.anchor === "middle" ? width / 2 : 0)));
    const initialY = Math.max(20, Math.min(980, label.y));
    let y = initialY;
    const direction = y < 500 ? -1 : 1;
    for (let attempt = 0; attempt < 72; attempt++) {
      y = Math.max(20, Math.min(980, initialY + Math.ceil(attempt / 2) * 28 * (attempt % 2 ? direction : -direction)));
      if (!boxes.some((box) => left < box.right + 8 && left + width + 8 > box.left && y - 12 < box.bottom + 4 && y + 12 > box.top - 4)) break;
    }
    boxes.push({ left, right: left + width, top: y - 12, bottom: y + 12 });
    return { path: label.path, x: left + (label.anchor === "end" ? width : label.anchor === "middle" ? width / 2 : 0), y, left, right: left + width };
  });
}
