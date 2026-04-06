import type { InputState, SimulationEvent, WorldState } from "./types";
import type { WorldWithEcs } from "./ecs/types";
import {
  closePortMenuEcs,
  drainSimulationEventsEcs,
  tryPurchaseHullUpgradeEcs,
  trySellCargoEcs,
  updateEcsSimulation
} from "./ecs/updateEcsSimulation";

function asEcsWorld(worldState: WorldState): WorldWithEcs {
  return worldState as WorldWithEcs;
}

export function closePortMenu(worldState: WorldState): void {
  closePortMenuEcs(asEcsWorld(worldState));
}

export function tryPurchaseHullUpgrade(worldState: WorldState): boolean {
  return tryPurchaseHullUpgradeEcs(asEcsWorld(worldState));
}

export function trySellCargo(worldState: WorldState): boolean {
  return trySellCargoEcs(asEcsWorld(worldState));
}

export function drainSimulationEvents(worldState: WorldState): SimulationEvent[] {
  return drainSimulationEventsEcs(asEcsWorld(worldState));
}

export function updateSimulation(worldState: WorldState, inputState: InputState, dt: number): void {
  updateEcsSimulation(asEcsWorld(worldState), inputState, dt);
}
