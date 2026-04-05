import { TREASURE_INTERACT_RADIUS, type WorldEventKind, type WorldState } from "../simulation";

interface HudOptions {
  onUpgradeRequest: () => void;
  onCloseDockMenu: () => void;
  target?: Window;
}

export interface HudController {
  update: (worldState: WorldState) => void;
  dispose: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isLootNearby(worldState: WorldState): boolean {
  const player = worldState.player;
  for (const loot of worldState.loot) {
    if (!loot.active) {
      continue;
    }
    const dx = loot.position.x - player.position.x;
    const dz = loot.position.z - player.position.z;
    const range = loot.pickupRadius + player.radius * 0.75;
    if (dx * dx + dz * dz <= range * range) {
      return true;
    }
  }
  return false;
}

function isTreasureNearby(worldState: WorldState): boolean {
  if (!worldState.treasureObjective.active) {
    return false;
  }
  const marker = worldState.treasureObjective.markerPosition;
  const dx = marker.x - worldState.player.position.x;
  const dz = marker.z - worldState.player.position.z;
  return dx * dx + dz * dz <= TREASURE_INTERACT_RADIUS ** 2;
}

function getIslandLabel(worldState: WorldState, islandId: number | null): string {
  if (islandId === null) {
    return "Unknown isle";
  }
  return worldState.islands.find((island) => island.id === islandId)?.label ?? "Unknown isle";
}

function formatEventLabel(kind: WorldEventKind | null): string {
  switch (kind) {
    case "treasure_marker":
      return "Treasure Marker";
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

function getIslandMinimapColor(kind: string): string {
  switch (kind) {
    case "port":
      return "#f2d082";
    case "treasure":
      return "#ffd75c";
    case "hostile":
      return "#d96f66";
    case "scenic":
      return "#87d6ab";
    default:
      return "#d7e3ea";
  }
}

function drawMinimap(worldState: WorldState, canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const radius = Math.min(width, height) * 0.46;
  const worldToPixel = radius / (worldState.boundsRadius * 1.04);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(8, 23, 33, 0.58)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(220, 238, 248, 0.42)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  const drawDot = (x: number, z: number, color: string, size: number): void => {
    const px = centerX + x * worldToPixel;
    const py = centerY - z * worldToPixel;
    const dx = px - centerX;
    const dy = py - centerY;
    const distance = Math.hypot(dx, dy);
    const safeDistance = Math.max(0, radius - 4);

    const fx = distance > safeDistance && distance > 0 ? centerX + (dx / distance) * safeDistance : px;
    const fy = distance > safeDistance && distance > 0 ? centerY + (dy / distance) * safeDistance : py;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(fx, fy, size, 0, Math.PI * 2);
    ctx.fill();
  };

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
  ctx.clip();

  if (worldState.storm.active) {
    const stormX = centerX + worldState.storm.center.x * worldToPixel;
    const stormY = centerY - worldState.storm.center.z * worldToPixel;
    const stormRadius = worldState.storm.radius * worldToPixel;

    ctx.strokeStyle = "rgba(161, 196, 219, 0.65)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(stormX, stormY, stormRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(112, 147, 176, 0.18)";
    ctx.beginPath();
    ctx.arc(stormX, stormY, stormRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const island of worldState.islands) {
    drawDot(island.position.x, island.position.z, getIslandMinimapColor(island.kind), island.kind === "port" ? 4.3 : 2.5);
  }

  for (const loot of worldState.loot) {
    if (!loot.active) {
      continue;
    }
    drawDot(loot.position.x, loot.position.z, loot.kind === "gold" ? "#ffd54f" : "#8ae5af", 2.2);
  }

  if (worldState.treasureObjective.active) {
    drawDot(worldState.treasureObjective.markerPosition.x, worldState.treasureObjective.markerPosition.z, "#ffe68d", 3.6);
    drawDot(worldState.treasureObjective.markerPosition.x, worldState.treasureObjective.markerPosition.z, "#6c5320", 1.2);
  }

  for (const enemy of worldState.enemies) {
    if (enemy.status !== "alive") {
      continue;
    }
    const color = enemy.archetype === "navy" ? "#8cb8e8" : enemy.archetype === "merchant" ? "#f1cf8b" : "#ff6f62";
    drawDot(enemy.position.x, enemy.position.z, color, enemy.archetype === "navy" ? 3.3 : 2.9);
  }

  ctx.restore();

  const player = worldState.player;
  const playerX = centerX + player.position.x * worldToPixel;
  const playerY = centerY - player.position.z * worldToPixel;

  ctx.save();
  ctx.translate(playerX, playerY);
  ctx.rotate(player.heading);
  ctx.fillStyle = "#f3fbff";
  ctx.beginPath();
  ctx.moveTo(0, -5.5);
  ctx.lineTo(3.8, 5);
  ctx.lineTo(-3.8, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function createHud(root: HTMLElement, options: HudOptions): HudController {
  const target = options.target ?? window;

  const layer = document.createElement("div");
  layer.className = "hud-layer";
  root.appendChild(layer);

  const topLeft = document.createElement("section");
  topLeft.className = "hud-panel hud-panel-primary";
  layer.appendChild(topLeft);

  const hpLabel = document.createElement("div");
  hpLabel.className = "hud-row";
  topLeft.appendChild(hpLabel);

  const hpBarTrack = document.createElement("div");
  hpBarTrack.className = "meter-track";
  const hpBarFill = document.createElement("div");
  hpBarFill.className = "meter-fill meter-fill-hp";
  hpBarTrack.appendChild(hpBarFill);
  topLeft.appendChild(hpBarTrack);

  const reloadLabel = document.createElement("div");
  reloadLabel.className = "hud-row";
  topLeft.appendChild(reloadLabel);

  const walletLabel = document.createElement("div");
  walletLabel.className = "hud-row";
  topLeft.appendChild(walletLabel);

  const eventLabel = document.createElement("div");
  eventLabel.className = "hud-row hud-event";
  topLeft.appendChild(eventLabel);

  const objectiveLabel = document.createElement("div");
  objectiveLabel.className = "hud-objective";
  topLeft.appendChild(objectiveLabel);

  const minimapPanel = document.createElement("section");
  minimapPanel.className = "hud-panel hud-panel-minimap";
  layer.appendChild(minimapPanel);

  const minimapTitle = document.createElement("div");
  minimapTitle.className = "hud-minimap-title";
  minimapTitle.textContent = "Sea Chart";
  minimapPanel.appendChild(minimapTitle);

  const minimapCanvas = document.createElement("canvas");
  minimapCanvas.className = "hud-minimap-canvas";
  minimapCanvas.width = 170;
  minimapCanvas.height = 170;
  minimapPanel.appendChild(minimapCanvas);

  const prompt = document.createElement("div");
  prompt.className = "hud-prompt";
  layer.appendChild(prompt);

  const dockMenu = document.createElement("section");
  dockMenu.className = "dock-menu";
  layer.appendChild(dockMenu);

  const dockTitle = document.createElement("h2");
  dockTitle.textContent = "Port Dock";
  dockMenu.appendChild(dockTitle);

  const dockDesc = document.createElement("p");
  dockDesc.textContent = "Hull Reinforcement";
  dockMenu.appendChild(dockDesc);

  const upgradeMeta = document.createElement("div");
  upgradeMeta.className = "dock-menu-meta";
  dockMenu.appendChild(upgradeMeta);

  const upgradeButton = document.createElement("button");
  upgradeButton.type = "button";
  upgradeButton.className = "dock-menu-upgrade";
  upgradeButton.addEventListener("click", () => {
    options.onUpgradeRequest();
  });
  dockMenu.appendChild(upgradeButton);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "dock-menu-close";
  closeButton.textContent = "Undock (Esc)";
  closeButton.addEventListener("click", () => {
    options.onCloseDockMenu();
  });
  dockMenu.appendChild(closeButton);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== "Escape") {
      return;
    }
    options.onCloseDockMenu();
  };
  target.addEventListener("keydown", onKeyDown);

  return {
    update: (worldState) => {
      const hpPercent = worldState.player.maxHp > 0 ? (worldState.player.hp / worldState.player.maxHp) * 100 : 0;
      hpLabel.textContent = `Hull ${Math.round(worldState.player.hp)} / ${Math.round(worldState.player.maxHp)}`;
      hpBarFill.style.width = `${clamp(hpPercent, 0, 100).toFixed(1)}%`;

      reloadLabel.textContent = `Cannons L ${worldState.player.reload.left.toFixed(1)}s  R ${worldState.player.reload.right.toFixed(1)}s`;
      walletLabel.textContent = `Gold ${worldState.wallet.gold}  Materials ${worldState.wallet.repairMaterials}`;

      const eventTitle = formatEventLabel(worldState.eventDirector.activeKind);
      if (worldState.eventDirector.activeKind) {
        eventLabel.textContent = `${eventTitle}  ${Math.ceil(Math.max(0, worldState.eventDirector.remaining))}s`;
      } else {
        eventLabel.textContent = `${eventTitle}  next in ${Math.ceil(Math.max(0, worldState.eventDirector.timer))}s`;
      }

      if (worldState.treasureObjective.active) {
        objectiveLabel.textContent = `Objective: Reach ${getIslandLabel(worldState, worldState.treasureObjective.targetIslandId)} and press Space (+${worldState.treasureObjective.rewardGold}g).`;
      } else if (worldState.wallet.gold >= worldState.upgrade.nextCost) {
        objectiveLabel.textContent = "Objective: Dock at port and buy Hull Reinforcement.";
      } else {
        objectiveLabel.textContent = worldState.eventDirector.statusText;
      }

      const lootNearby = isLootNearby(worldState);
      const treasureNearby = isTreasureNearby(worldState);
      if (worldState.port.menuOpen) {
        prompt.textContent = "Docked. Use menu, then press Esc or Space to undock.";
      } else if (lootNearby) {
        prompt.textContent = "Press Space to collect floating loot.";
      } else if (treasureNearby) {
        prompt.textContent = "Press Space to secure treasure cache.";
      } else if (worldState.port.playerNearPort) {
        prompt.textContent = "Press Space to dock at port.";
      } else if (
        worldState.player.repairCooldown <= 0 &&
        worldState.wallet.repairMaterials > 0 &&
        worldState.player.hp < worldState.player.maxHp
      ) {
        prompt.textContent = "Press R to use repair materials.";
      } else {
        prompt.textContent = "Sail, broadside, and chase marked opportunities.";
      }

      upgradeMeta.textContent =
        `Hull Level ${worldState.upgrade.hullLevel}  |  Next Cost ${worldState.upgrade.nextCost} gold  |  +20 Max HP`;
      upgradeButton.textContent = `Buy Hull Reinforcement (${worldState.upgrade.nextCost}g)`;
      upgradeButton.disabled = worldState.wallet.gold < worldState.upgrade.nextCost || !worldState.port.menuOpen;

      dockMenu.style.display = worldState.port.menuOpen ? "flex" : "none";
      drawMinimap(worldState, minimapCanvas);
    },
    dispose: () => {
      target.removeEventListener("keydown", onKeyDown);
      layer.remove();
    }
  };
}
