import type { CannonSide } from "./types";

export interface SideVector2 {
  x: number;
  z: number;
}

export function calculateForwardVector(heading: number): SideVector2 {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

export function calculateLeftVector(heading: number): SideVector2 {
  const forward = calculateForwardVector(heading);
  return { x: -forward.z, z: forward.x };
}

export function getBroadsideVector(heading: number, side: CannonSide): SideVector2 {
  const left = calculateLeftVector(heading);
  return side === "left" ? { x: -left.x, z: -left.z } : left;
}

export function sideDotAgainstShipLeft(heading: number, relativeX: number, relativeZ: number): number {
  const left = calculateLeftVector(heading);
  return relativeX * left.x + relativeZ * left.z;
}

export function classifySideFromLeftDot(sideDot: number): CannonSide {
  return sideDot >= 0 ? "left" : "right";
}

export function classifyRelativeSide(heading: number, relativeX: number, relativeZ: number): CannonSide {
  return classifySideFromLeftDot(sideDotAgainstShipLeft(heading, relativeX, relativeZ));
}
