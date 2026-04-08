import { type WorldEventKind, type WorldState } from "../simulation";

export type PromptPriority = "interaction" | "danger" | "hint";

export interface PromptInfo {
  text: string;
  priority: PromptPriority;
}

const DANGER_HP_THRESHOLD = 0.35;
const DANGER_ENEMY_DISTANCE = 18;

function distanceSquared(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

function isLootNearby(worldState: WorldState): boolean {
  const player = worldState.player;
  for (const loot of worldState.loot) {
    if (!loot.active) {
      continue;
    }
    const range = loot.pickupRadius + player.radius * 0.75;
    if (distanceSquared(loot.position.x, loot.position.z, player.position.x, player.position.z) <= range * range) {
      return true;
    }
  }
  return false;
}

function isStormDanger(worldState: WorldState): boolean {
  if (!worldState.storm.active) {
    return false;
  }
  return (
    distanceSquared(
      worldState.player.position.x,
      worldState.player.position.z,
      worldState.storm.center.x,
      worldState.storm.center.z
    ) <= worldState.storm.radius ** 2
  );
}

function hasNearbyEnemy(worldState: WorldState, threshold: number): boolean {
  const thresholdSq = threshold * threshold;
  for (const enemy of worldState.enemies) {
    if (enemy.status !== "alive") {
      continue;
    }
    if (
      distanceSquared(worldState.player.position.x, worldState.player.position.z, enemy.position.x, enemy.position.z) <= thresholdSq
    ) {
      return true;
    }
  }
  return false;
}

export function formatEventLabel(kind: WorldEventKind | null): string {
  switch (kind) {
    case "enemy_convoy":
      return "Enemy Convoy";
    case "storm":
      return "Storm Front";
    case "navy_patrol":
      return "Navy Patrol";
    default:
      return "Open Seas";
  }
}

export function resolvePrompt(worldState: WorldState): PromptInfo {
  if (worldState.port.menuOpen) {
    return {
      text: "Docked. Trade, upgrade, then press Esc or Space to undock.",
      priority: "interaction"
    };
  }

  if (isLootNearby(worldState)) {
    return {
      text: "Press Space to collect floating loot.",
      priority: "interaction"
    };
  }

  if (worldState.port.playerNearPort) {
    return {
      text: "Press Space to dock at port.",
      priority: "interaction"
    };
  }

  const hpPercent = worldState.player.maxHp > 0 ? worldState.player.hp / worldState.player.maxHp : 0;
  if (hpPercent <= DANGER_HP_THRESHOLD) {
    return {
      text: "Hull is critical. Break away and repair with R when ready.",
      priority: "danger"
    };
  }

  if (hasNearbyEnemy(worldState, DANGER_ENEMY_DISTANCE)) {
    return {
      text: "Enemy broadside range. Keep turning and fire left/right with Q/E.",
      priority: "danger"
    };
  }

  if (isStormDanger(worldState)) {
    return {
      text: "Storm squalls are slowing your ship. Steer out of the ring.",
      priority: "danger"
    };
  }

  if (worldState.burst.cooldown <= 0) {
    return {
      text: "Hold Shift for a speed burst.",
      priority: "hint"
    };
  }

  if (
    worldState.player.repairCooldown <= 0 &&
    worldState.wallet.repairMaterials > 0 &&
    worldState.player.hp < worldState.player.maxHp
  ) {
    return {
      text: "Press R to spend repair materials.",
      priority: "hint"
    };
  }

  return {
    text: "Sail, broadside, and chase marked opportunities.",
    priority: "hint"
  };
}
