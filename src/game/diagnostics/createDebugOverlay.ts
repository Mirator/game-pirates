interface DebugSnapshot {
  fps: number;
  playerHp: number;
  playerMaxHp: number;
  enemiesAlive: number;
  lootCount: number;
  gold: number;
  repairMaterials: number;
  cargo: number;
  treasureMaps: number;
  playerReloadLeft: number;
  playerReloadRight: number;
  burstActive: boolean;
  burstCooldown: number;
  menuOpen: boolean;
  activeEvent: string;
  combatIntensity: number;
  stormActive: boolean;
}

export interface DebugOverlay {
  setSnapshot: (snapshot: DebugSnapshot) => void;
  dispose: () => void;
}

function formatSeconds(value: number): string {
  return value.toFixed(2);
}

export function createDebugOverlay(root: HTMLElement, target: Window = window): DebugOverlay {
  const panel = document.createElement("div");
  panel.setAttribute("aria-label", "Phase 1 debug readout");
  panel.style.position = "fixed";
  panel.style.top = "10px";
  panel.style.left = "10px";
  panel.style.padding = "8px 10px";
  panel.style.border = "1px solid rgba(20, 40, 55, 0.45)";
  panel.style.borderRadius = "6px";
  panel.style.background = "rgba(255, 250, 231, 0.82)";
  panel.style.color = "#1c2f3d";
  panel.style.font = "12px/1.3 Consolas, Monaco, monospace";
  panel.style.pointerEvents = "none";
  panel.style.whiteSpace = "pre";
  panel.style.userSelect = "none";
  panel.style.display = "none";
  root.appendChild(panel);

  let visible = false;

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== "F3") {
      return;
    }
    visible = !visible;
    panel.style.display = visible ? "block" : "none";
  };

  target.addEventListener("keydown", onKeyDown);

  return {
    setSnapshot: (snapshot) => {
      if (!visible) {
        return;
      }

      panel.textContent =
        `FPS ${snapshot.fps.toFixed(0)}\n` +
        `Player HP ${snapshot.playerHp.toFixed(0)} / ${snapshot.playerMaxHp.toFixed(0)}\n` +
        `Enemies ${snapshot.enemiesAlive} | Loot ${snapshot.lootCount}\n` +
        `Gold ${snapshot.gold} | Mats ${snapshot.repairMaterials} | Cargo ${snapshot.cargo} | Maps ${snapshot.treasureMaps}\n` +
        `Menu ${snapshot.menuOpen ? "OPEN" : "CLOSED"} | Storm ${snapshot.stormActive ? "YES" : "NO"}\n` +
        `Burst ${snapshot.burstActive ? "ON" : "OFF"} | Cooldown ${formatSeconds(snapshot.burstCooldown)}s\n` +
        `Event ${snapshot.activeEvent} | Combat ${snapshot.combatIntensity.toFixed(2)}\n` +
        `Reload L ${formatSeconds(snapshot.playerReloadLeft)}s | R ${formatSeconds(snapshot.playerReloadRight)}s`;
    },
    dispose: () => {
      target.removeEventListener("keydown", onKeyDown);
      panel.remove();
    }
  };
}
