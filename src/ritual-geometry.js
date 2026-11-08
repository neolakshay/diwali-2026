// Pointer coordinates are viewport pixels; positioned orbs use untransformed field pixels.
export function pointInField(point, bounds, width, height) {
  return {
    x: Math.min(width, Math.max(0, (point.clientX - bounds.left) * width / bounds.width)),
    y: Math.min(height, Math.max(0, (point.clientY - bounds.top) * height / bounds.height)),
  };
}
