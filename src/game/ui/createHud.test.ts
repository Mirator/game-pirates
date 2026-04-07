import { describe, expect, it } from "vitest";
import { projectWorldToMinimapPlane, worldHeadingToMinimapRotation } from "./createHud";

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

  it("keeps arrow direction aligned with mapped forward movement across headings", () => {
    const headings = [0, Math.PI * 0.5, -Math.PI * 0.5, Math.PI * 0.25, -Math.PI * 0.75];

    for (const heading of headings) {
      const worldForwardX = Math.sin(heading);
      const worldForwardZ = Math.cos(heading);
      const mappedForward = projectWorldToMinimapPlane(worldForwardX, worldForwardZ);
      const tip = rotateTip(heading);

      const forwardLength = Math.hypot(mappedForward.x, mappedForward.y);
      const tipLength = Math.hypot(tip.x, tip.y);
      const dot = mappedForward.x * tip.x + mappedForward.y * tip.y;
      const cosine = dot / Math.max(1e-8, forwardLength * tipLength);

      expect(cosine).toBeGreaterThan(0.999);
    }
  });
});
