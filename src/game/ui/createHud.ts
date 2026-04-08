import { CANNON_RELOAD_TIME, CARGO_SALE_VALUE, UPGRADE_HULL_HP_BONUS, type WorldState } from "../simulation";
import { drawMinimap } from "./hudMinimap";
import { resolvePrompt, type PromptPriority } from "./hudPrompt";
export { projectWorldToMinimapPlane, worldHeadingToMinimapRotation } from "./hudMinimap";

interface HudOptions {
  onUpgradeRequest: () => void;
  onSellCargoRequest: () => void;
  onCloseDockMenu: () => void;
  onUiLockChange: (locked: boolean) => void;
  target?: Window;
}

export interface HudController {
  update: (worldState: WorldState) => void;
  isUiLocked: () => boolean;
  dispose: () => void;
}

const LOW_PRIORITY_FADE_DELAY_MS = 2800;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function setVisibility(element: HTMLElement, visible: boolean, displayValue: "block" | "flex" = "block"): void {
  element.style.display = visible ? displayValue : "none";
}

export function createHud(root: HTMLElement, options: HudOptions): HudController {
  const target = options.target ?? window;

  const layer = document.createElement("div");
  layer.className = "hud-layer";
  root.appendChild(layer);

  const statusPanel = document.createElement("section");
  statusPanel.className = "hud-panel hud-panel-primary";
  layer.appendChild(statusPanel);

  const statusTitle = document.createElement("div");
  statusTitle.className = "hud-panel-title";
  statusTitle.textContent = "Captain's Ledger";
  statusPanel.appendChild(statusTitle);

  const hullRow = document.createElement("div");
  hullRow.className = "hud-row hud-row-split";
  statusPanel.appendChild(hullRow);

  const hullLabel = document.createElement("span");
  hullLabel.className = "hud-label";
  hullLabel.textContent = "Hull Integrity";
  hullRow.appendChild(hullLabel);

  const hullValue = document.createElement("span");
  hullValue.className = "hud-value";
  hullRow.appendChild(hullValue);

  const hpBarTrack = document.createElement("div");
  hpBarTrack.className = "meter-track";
  const hpBarFill = document.createElement("div");
  hpBarFill.className = "meter-fill meter-fill-hp";
  hpBarTrack.appendChild(hpBarFill);
  statusPanel.appendChild(hpBarTrack);

  const resourcesRow = document.createElement("div");
  resourcesRow.className = "hud-chip-row";
  statusPanel.appendChild(resourcesRow);

  const goldChip = document.createElement("span");
  goldChip.className = "hud-chip";
  resourcesRow.appendChild(goldChip);

  const matsChip = document.createElement("span");
  matsChip.className = "hud-chip";
  resourcesRow.appendChild(matsChip);

  const cargoChip = document.createElement("span");
  cargoChip.className = "hud-chip";
  resourcesRow.appendChild(cargoChip);

  const reloadGrid = document.createElement("div");
  reloadGrid.className = "hud-reload-grid";
  statusPanel.appendChild(reloadGrid);

  const leftReloadCard = document.createElement("div");
  leftReloadCard.className = "hud-reload-card";
  reloadGrid.appendChild(leftReloadCard);

  const leftReloadTop = document.createElement("div");
  leftReloadTop.className = "hud-row hud-row-split hud-row-tight";
  leftReloadCard.appendChild(leftReloadTop);

  const leftReloadLabel = document.createElement("span");
  leftReloadLabel.className = "hud-label";
  leftReloadLabel.textContent = "Left Cannons";
  leftReloadTop.appendChild(leftReloadLabel);

  const leftReloadValue = document.createElement("span");
  leftReloadValue.className = "hud-value";
  leftReloadTop.appendChild(leftReloadValue);

  const leftReloadTrack = document.createElement("div");
  leftReloadTrack.className = "meter-track meter-track-small";
  leftReloadCard.appendChild(leftReloadTrack);

  const leftReloadFill = document.createElement("div");
  leftReloadFill.className = "meter-fill meter-fill-reload";
  leftReloadTrack.appendChild(leftReloadFill);

  const rightReloadCard = document.createElement("div");
  rightReloadCard.className = "hud-reload-card";
  reloadGrid.appendChild(rightReloadCard);

  const rightReloadTop = document.createElement("div");
  rightReloadTop.className = "hud-row hud-row-split hud-row-tight";
  rightReloadCard.appendChild(rightReloadTop);

  const rightReloadLabel = document.createElement("span");
  rightReloadLabel.className = "hud-label";
  rightReloadLabel.textContent = "Right Cannons";
  rightReloadTop.appendChild(rightReloadLabel);

  const rightReloadValue = document.createElement("span");
  rightReloadValue.className = "hud-value";
  rightReloadTop.appendChild(rightReloadValue);

  const rightReloadTrack = document.createElement("div");
  rightReloadTrack.className = "meter-track meter-track-small";
  rightReloadCard.appendChild(rightReloadTrack);

  const rightReloadFill = document.createElement("div");
  rightReloadFill.className = "meter-fill meter-fill-reload";
  rightReloadTrack.appendChild(rightReloadFill);

  const minimapPanel = document.createElement("section");
  minimapPanel.className = "hud-panel hud-panel-minimap";
  layer.appendChild(minimapPanel);

  const minimapTitle = document.createElement("div");
  minimapTitle.className = "hud-minimap-title";
  minimapTitle.textContent = "Sea Chart";
  minimapPanel.appendChild(minimapTitle);

  const minimapCanvas = document.createElement("canvas");
  minimapCanvas.className = "hud-minimap-canvas";
  minimapCanvas.width = 160;
  minimapCanvas.height = 160;
  minimapPanel.appendChild(minimapCanvas);

  const minimapLegend = document.createElement("div");
  minimapLegend.className = "hud-minimap-legend";
  minimapLegend.innerHTML =
    '<span><i style="background:#ebc57a"></i>Port</span>' +
    '<span><i style="background:#ff6f62"></i>Enemy</span>';
  minimapPanel.appendChild(minimapLegend);

  const prompt = document.createElement("div");
  prompt.className = "hud-prompt";
  layer.appendChild(prompt);

  const dockBackdrop = document.createElement("div");
  dockBackdrop.className = "hud-modal-backdrop";
  layer.appendChild(dockBackdrop);

  const dockMenu = document.createElement("section");
  dockMenu.className = "dock-menu";
  dockMenu.setAttribute("data-testid", "dock-menu");
  layer.appendChild(dockMenu);

  const dockTitle = document.createElement("h2");
  dockTitle.textContent = "Port Dock";
  dockMenu.appendChild(dockTitle);

  const dockDesc = document.createElement("p");
  dockDesc.className = "dock-menu-desc";
  dockDesc.textContent = "Harbor Services";
  dockMenu.appendChild(dockDesc);

  const upgradeMeta = document.createElement("div");
  upgradeMeta.className = "dock-menu-meta";
  dockMenu.appendChild(upgradeMeta);

  const upgradeOutcome = document.createElement("div");
  upgradeOutcome.className = "dock-menu-outcome";
  dockMenu.appendChild(upgradeOutcome);

  const cargoOutcome = document.createElement("div");
  cargoOutcome.className = "dock-menu-outcome";
  dockMenu.appendChild(cargoOutcome);

  const upgradeButton = document.createElement("button");
  upgradeButton.type = "button";
  upgradeButton.className = "dock-menu-upgrade";
  upgradeButton.addEventListener("click", () => {
    options.onUpgradeRequest();
  });
  dockMenu.appendChild(upgradeButton);

  const sellCargoButton = document.createElement("button");
  sellCargoButton.type = "button";
  sellCargoButton.className = "dock-menu-upgrade";
  sellCargoButton.addEventListener("click", () => {
    options.onSellCargoRequest();
  });
  dockMenu.appendChild(sellCargoButton);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "dock-menu-close";
  closeButton.textContent = "Undock (Esc)";
  closeButton.addEventListener("click", () => {
    options.onCloseDockMenu();
  });
  dockMenu.appendChild(closeButton);

  const pauseBackdrop = document.createElement("div");
  pauseBackdrop.className = "hud-modal-backdrop";
  layer.appendChild(pauseBackdrop);

  const pauseMenu = document.createElement("section");
  pauseMenu.className = "pause-menu";
  pauseMenu.setAttribute("data-testid", "pause-menu");
  layer.appendChild(pauseMenu);

  const pauseTitle = document.createElement("h2");
  pauseTitle.textContent = "Captain's Log";
  pauseMenu.appendChild(pauseTitle);

  const pauseSub = document.createElement("p");
  pauseSub.className = "pause-menu-sub";
  pauseSub.textContent = "Keep the center sea lane clear and engage on your broadside.";
  pauseMenu.appendChild(pauseSub);

  const controlsTitle = document.createElement("h3");
  controlsTitle.textContent = "Controls";
  pauseMenu.appendChild(controlsTitle);

  const controlsList = document.createElement("p");
  controlsList.className = "pause-menu-list";
  controlsList.textContent = "W/S speed  A/D turn  Q left fire  E right fire  Space interact  R repair  Shift burst  Esc pause";
  pauseMenu.appendChild(controlsList);

  const loopTipsTitle = document.createElement("h3");
  loopTipsTitle.textContent = "Loop Tips";
  pauseMenu.appendChild(loopTipsTitle);

  const loopTips = document.createElement("p");
  loopTips.className = "pause-menu-list";
  loopTips.textContent = "Sink raiders, collect cargo, dock to sell, then buy hull upgrades before tougher events.";
  pauseMenu.appendChild(loopTips);

  const pauseButtons = document.createElement("div");
  pauseButtons.className = "pause-menu-actions";
  pauseMenu.appendChild(pauseButtons);

  const resumeButton = document.createElement("button");
  resumeButton.type = "button";
  resumeButton.className = "pause-menu-primary";
  resumeButton.textContent = "Resume (Esc)";
  pauseButtons.appendChild(resumeButton);

  let dockMenuOpen = false;
  let pauseOpen = false;
  let uiLocked = false;
  let promptText = "";
  let promptPriority: PromptPriority = "hint";
  let promptChangedAt = target.performance.now();

  const syncUiLock = (): void => {
    const nextLock = dockMenuOpen || pauseOpen;
    if (nextLock === uiLocked) {
      return;
    }
    uiLocked = nextLock;
    options.onUiLockChange(uiLocked);
  };

  const applyModalVisibility = (): void => {
    setVisibility(dockBackdrop, dockMenuOpen);
    setVisibility(dockMenu, dockMenuOpen, "flex");

    setVisibility(pauseBackdrop, pauseOpen);
    setVisibility(pauseMenu, pauseOpen, "flex");

    syncUiLock();
  };

  const setPauseOpen = (open: boolean): void => {
    pauseOpen = open;
    applyModalVisibility();
  };

  resumeButton.addEventListener("click", () => {
    setPauseOpen(false);
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Space" && dockMenuOpen) {
      event.preventDefault();
      dockMenuOpen = false;
      applyModalVisibility();
      options.onCloseDockMenu();
      return;
    }

    if (event.code !== "Escape") {
      return;
    }

    event.preventDefault();

    if (dockMenuOpen) {
      dockMenuOpen = false;
      applyModalVisibility();
      options.onCloseDockMenu();
      return;
    }

    if (pauseOpen) {
      setPauseOpen(false);
      return;
    }

    setPauseOpen(true);
  };

  target.addEventListener("keydown", onKeyDown);

  applyModalVisibility();

  const updateReloadCard = (value: number, valueLabel: HTMLElement, fill: HTMLElement, card: HTMLElement): void => {
    const remaining = Math.max(0, value);
    const ready = remaining <= 0.05;
    const readiness = clamp(1 - remaining / CANNON_RELOAD_TIME, 0, 1);

    valueLabel.textContent = ready ? "Ready" : `${remaining.toFixed(1)}s`;
    card.classList.toggle("is-ready", ready);
    fill.style.width = `${(readiness * 100).toFixed(1)}%`;
  };

  return {
    update: (worldState) => {
      if (dockMenuOpen !== worldState.port.menuOpen) {
        dockMenuOpen = worldState.port.menuOpen;
        applyModalVisibility();
      }

      const hpPercent = worldState.player.maxHp > 0 ? (worldState.player.hp / worldState.player.maxHp) * 100 : 0;
      hullValue.textContent = `${Math.round(worldState.player.hp)} / ${Math.round(worldState.player.maxHp)}`;
      hpBarFill.style.width = `${clamp(hpPercent, 0, 100).toFixed(1)}%`;
      hpBarFill.classList.toggle("is-critical", hpPercent <= 35);

      goldChip.textContent = `Gold ${worldState.wallet.gold}`;
      matsChip.textContent = `Mats ${worldState.wallet.repairMaterials}`;
      cargoChip.textContent = `Cargo ${worldState.wallet.cargo}`;

      updateReloadCard(worldState.player.reload.left, leftReloadValue, leftReloadFill, leftReloadCard);
      updateReloadCard(worldState.player.reload.right, rightReloadValue, rightReloadFill, rightReloadCard);

      const promptInfo = resolvePrompt(worldState);
      if (promptInfo.text !== promptText || promptInfo.priority !== promptPriority) {
        promptText = promptInfo.text;
        promptPriority = promptInfo.priority;
        promptChangedAt = target.performance.now();
      }
      prompt.textContent = promptText;
      prompt.dataset.priority = promptPriority;
      const shouldMuteHint = promptPriority === "hint" && target.performance.now() - promptChangedAt >= LOW_PRIORITY_FADE_DELAY_MS;
      prompt.classList.toggle("hud-prompt-muted", shouldMuteHint);

      const cargoSellValue = worldState.wallet.cargo * CARGO_SALE_VALUE;
      upgradeMeta.textContent = `Hull Lv ${worldState.upgrade.hullLevel}  |  Next Cost ${worldState.upgrade.nextCost}g`;
      upgradeOutcome.textContent = `Reinforcement grants +${UPGRADE_HULL_HP_BONUS} max hull on purchase.`;
      cargoOutcome.textContent = `Cargo hold value: ${cargoSellValue} gold.`;

      upgradeButton.textContent = `Buy Hull Reinforcement (${worldState.upgrade.nextCost}g)`;
      upgradeButton.disabled = worldState.wallet.gold < worldState.upgrade.nextCost || !worldState.port.menuOpen;

      sellCargoButton.textContent = `Sell Cargo (${worldState.wallet.cargo} units)`;
      sellCargoButton.disabled = worldState.wallet.cargo <= 0 || !worldState.port.menuOpen;

      drawMinimap(worldState, minimapCanvas);
    },
    isUiLocked: () => uiLocked,
    dispose: () => {
      target.removeEventListener("keydown", onKeyDown);
      layer.remove();
    }
  };
}

