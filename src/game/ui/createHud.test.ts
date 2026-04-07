import { describe, expect, it } from "vitest";
import { worldHeadingToMinimapRotation } from "./createHud";

function rotateTip(heading: number): { x: number; y: number } {
  const rotation = worldHeadingToMinimapRotation(heading);
  const sin = Math.sin(rotation);
  const cos = Math.cos(rotation);
  const tipX = 0;
  const tipY = -1;
  return {
    x: tipX * cos - tipY * sin,
    y: tipX * sin + tipY * cos
  };
}

describe("worldHeadingToMinimapRotation", () => {
  it("keeps north at heading 0", () => {
    const tip = rotateTip(0);
    expect(tip.x).toBeCloseTo(0, 6);
    expect(tip.y).toBeLessThan(0);
  });

  it("rotates arrow to the right for negative heading", () => {
    const tip = rotateTip(-Math.PI * 0.5);
    expect(tip.x).toBeGreaterThan(0);
    expect(Math.abs(tip.y)).toBeLessThan(1e-6);
  });
});
