import type { WorldState } from "../simulation";

export function worldHeadingToMinimapRotation(heading: number): number {
  return -heading;
}

export function projectWorldToMinimapPlane(x: number, z: number): { x: number; y: number } {
  return { x: -x, y: -z };
}

function getIslandMinimapColor(kind: string): string {
  switch (kind) {
    case "port":
      return "#ebc57a";
    case "treasure":
      return "#f5d067";
    case "hostile":
      return "#d6665a";
    case "scenic":
      return "#73c8a4";
    default:
      return "#c6d7e0";
  }
}

export function drawMinimap(worldState: WorldState, canvas: HTMLCanvasElement): void {
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
  ctx.fillStyle = "rgba(8, 26, 37, 0.74)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(235, 220, 186, 0.52)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(218, 229, 236, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - radius + 6);
  ctx.lineTo(centerX, centerY + radius - 6);
  ctx.moveTo(centerX - radius + 6, centerY);
  ctx.lineTo(centerX + radius - 6, centerY);
  ctx.stroke();

  const drawDot = (x: number, z: number, color: string, size: number): void => {
    const mapped = projectWorldToMinimapPlane(x, z);
    const px = centerX + mapped.x * worldToPixel;
    const py = centerY + mapped.y * worldToPixel;
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
    const mappedStorm = projectWorldToMinimapPlane(worldState.storm.center.x, worldState.storm.center.z);
    const stormX = centerX + mappedStorm.x * worldToPixel;
    const stormY = centerY + mappedStorm.y * worldToPixel;
    const stormRadius = worldState.storm.radius * worldToPixel;

    ctx.strokeStyle = "rgba(153, 190, 217, 0.7)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(stormX, stormY, stormRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(123, 161, 187, 0.2)";
    ctx.beginPath();
    ctx.arc(stormX, stormY, stormRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const island of worldState.islands) {
    drawDot(island.position.x, island.position.z, getIslandMinimapColor(island.kind), island.kind === "port" ? 4.1 : 2.4);
  }

  for (const loot of worldState.loot) {
    if (!loot.active) {
      continue;
    }
    drawDot(loot.position.x, loot.position.z, loot.kind === "gold" ? "#f4cc5f" : "#7fd9a8", 2.1);
  }

  for (const enemy of worldState.enemies) {
    if (enemy.status !== "alive") {
      continue;
    }
    const color = enemy.archetype === "navy" ? "#8cb8e8" : enemy.archetype === "merchant" ? "#f1cf8b" : "#ff6f62";
    drawDot(enemy.position.x, enemy.position.z, color, enemy.archetype === "navy" ? 3.2 : 2.8);
  }

  ctx.restore();

  const player = worldState.player;
  const mappedPlayer = projectWorldToMinimapPlane(player.position.x, player.position.z);
  const playerX = centerX + mappedPlayer.x * worldToPixel;
  const playerY = centerY + mappedPlayer.y * worldToPixel;

  ctx.save();
  ctx.translate(playerX, playerY);
  ctx.rotate(worldHeadingToMinimapRotation(player.heading));
  ctx.strokeStyle = "rgba(247, 248, 250, 0.86)";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(0, -3.5);
  ctx.stroke();

  ctx.fillStyle = "#f6fbff";
  ctx.beginPath();
  ctx.moveTo(0, -5.8);
  ctx.lineTo(4.1, 5.2);
  ctx.lineTo(-4.1, 5.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (worldState.eventDirector.activeKind) {
    ctx.strokeStyle = "rgba(248, 219, 154, 0.44)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 7, 0, Math.PI * 2);
    ctx.stroke();
  }
}
