import type { WorldState } from "../simulation";

interface HudOptions {
  onUpgradeRequest: () => void;
  onCloseDockMenu: () => void;
  target?: Window;
}

export interface HudController {
  update: (worldState: WorldState) => void;
  dispose: () => void;
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

  ctx.strokeStyle = "rgba(220, 238, 248, 0.4)";
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

  drawDot(worldState.port.position.x, worldState.port.position.z, "#f2d082", 4.4);

  for (const loot of worldState.loot) {
    if (!loot.active) {
      continue;
    }
    drawDot(loot.position.x, loot.position.z, loot.kind === "gold" ? "#ffd54f" : "#8ae5af", 2.3);
  }

  for (const enemy of worldState.enemies) {
    if (enemy.status !== "alive") {
      continue;
    }
    drawDot(enemy.position.x, enemy.position.z, "#ff6f62", 3);
  }

  const player = worldState.player;
  const playerX = centerX + player.position.x * worldToPixel;
  const playerY = centerY - player.position.z * worldToPixel;
  const heading = player.heading;

  ctx.save();
  ctx.translate(playerX, playerY);
  ctx.rotate(heading);
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

      if (worldState.wallet.gold >= worldState.upgrade.nextCost) {
        objectiveLabel.textContent = "Objective: Dock at port and buy Hull Reinforcement.";
      } else {
        objectiveLabel.textContent = "Objective: Sink raiders, collect loot, and grow your ship.";
      }

      const lootNearby = isLootNearby(worldState);
      if (worldState.port.menuOpen) {
        prompt.textContent = "Docked. Use menu, then press Esc or Space to undock.";
      } else if (lootNearby) {
        prompt.textContent = "Press Space to collect floating loot.";
      } else if (worldState.port.playerInRange) {
        prompt.textContent = "Press Space to dock at port.";
      } else if (
        worldState.player.repairCooldown <= 0 &&
        worldState.wallet.repairMaterials > 0 &&
        worldState.player.hp < worldState.player.maxHp
      ) {
        prompt.textContent = "Press R to use repair materials.";
      } else {
        prompt.textContent = "Sail, broadside, and collect treasure.";
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
