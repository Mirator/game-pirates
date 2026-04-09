import {
  EVENT_CONVOY_DURATION,
  EVENT_NAVY_DURATION,
  EVENT_STORM_DURATION,
  STORM_INTENSITY_MAX,
  STORM_RADIUS
} from "../../constants";
import type { EnemyArchetype, WorldEventKind } from "../../types";
import type { WorldWithEcs } from "../types";

export interface EventSystemOptions {
  eventCycle: readonly WorldEventKind[];
  spawnEnemy: (archetype: EnemyArchetype, spawn?: { x: number; z: number; heading: number }) => void;
  chooseSpawnPoint: () => { x: number; z: number; heading: number };
  normalizeHeading: (heading: number) => number;
  hasAliveNavy: () => boolean;
  onWorldEventStarted: (kind: WorldEventKind) => void;
}

function spawnConvoy(options: EventSystemOptions): void {
  const base = options.chooseSpawnPoint();
  options.spawnEnemy("merchant", base);
  options.spawnEnemy("raider", {
    x: base.x + Math.cos(base.heading + Math.PI * 0.5) * 7,
    z: base.z + Math.sin(base.heading + Math.PI * 0.5) * 7,
    heading: options.normalizeHeading(base.heading + 0.1)
  });
}

function spawnNavyPatrol(options: EventSystemOptions): void {
  if (options.hasAliveNavy()) return;
  options.spawnEnemy("navy");
  options.spawnEnemy("raider");
}

function activateStorm(worldState: WorldWithEcs): void {
  const candidates = worldState.islands.filter((island) => island.kind === "hostile" || island.kind === "scenic");
  const pick =
    candidates[worldState.eventDirector.cycleIndex % Math.max(1, candidates.length)] ?? worldState.islands[0];
  if (!pick) return;
  worldState.storm.active = true;
  worldState.storm.center.x = pick.position.x;
  worldState.storm.center.z = pick.position.z;
  worldState.storm.remaining = EVENT_STORM_DURATION;
  worldState.storm.radius = STORM_RADIUS;
  worldState.storm.intensity = STORM_INTENSITY_MAX;
}

function startEvent(worldState: WorldWithEcs, kind: WorldEventKind, options: EventSystemOptions): void {
  worldState.eventDirector.activeKind = kind;
  switch (kind) {
    case "enemy_convoy":
      worldState.eventDirector.remaining = EVENT_CONVOY_DURATION;
      spawnConvoy(options);
      break;
    case "navy_patrol":
      worldState.eventDirector.remaining = EVENT_NAVY_DURATION;
      spawnNavyPatrol(options);
      break;
    case "storm":
      worldState.eventDirector.remaining = EVENT_STORM_DURATION;
      activateStorm(worldState);
      break;
  }
  options.onWorldEventStarted(kind);
}

export function updateEventTimer(
  worldState: WorldWithEcs,
  dt: number,
  options: EventSystemOptions
): void {
  const d = worldState.eventDirector;
  if (d.activeKind) {
    d.remaining -= dt;
    if (d.activeKind === "storm") {
      worldState.storm.remaining = Math.max(0, d.remaining);
      if (d.remaining <= 0) {
        worldState.storm.active = false;
        worldState.storm.remaining = 0;
      }
    }
    if (d.remaining <= 0) {
      d.activeKind = null;
      d.remaining = 0;
      d.timer = d.interval;
      d.statusText = "Open seas. Watch the horizon.";
    }
    return;
  }
  d.timer -= dt;
  if (d.timer > 0) return;
  const cycle = options.eventCycle;
  if (cycle.length === 0) {
    d.timer = d.interval;
    return;
  }
  const idx = d.cycleIndex % cycle.length;
  const kind = cycle[idx];
  d.cycleIndex = (d.cycleIndex + 1) % cycle.length;
  d.timer = d.interval;
  if (kind) startEvent(worldState, kind, options);
}
