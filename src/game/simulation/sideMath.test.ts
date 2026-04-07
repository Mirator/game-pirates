import { describe, expect, it } from "vitest";
import { classifyRelativeSide, getBroadsideVector } from "./sideMath";

describe("sideMath", () => {
  it("maps broadside vectors to screen-left/screen-right at heading 0", () => {
    const left = getBroadsideVector(0, "left");
    const right = getBroadsideVector(0, "right");

    expect(left.x).toBeGreaterThan(0);
    expect(right.x).toBeLessThan(0);
  });

  it("classifies projectile side against the ship left vector", () => {
    expect(classifyRelativeSide(0, -4, 0)).toBe("left");
    expect(classifyRelativeSide(0, 4, 0)).toBe("right");
  });
});
