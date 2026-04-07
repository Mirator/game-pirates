import { CANNON_RELOAD_TIME, CARGO_SALE_VALUE, UPGRADE_HULL_HP_BONUS, type WorldState } from "../simulation";
import { drawMinimap } from "./hudMinimap";
import { formatEventLabel, resolvePrompt, type PromptPriority } from "./hudPrompt";
import { createOnboardingStorage } from "./onboardingPersistence";
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

interface OnboardingStep {
  title: string;
  body: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: "Sail Like A Captain",
    body: "Use W/S to set speed and A/D to turn. Hold Shift for a short burst when you need to reposition fast."
  },
  {
    title: "Fight On The Broadside",
    body: "Fire left cannons with Q and right cannons with E. Watch reload bars and keep your hull angled."
  },
  {
    title: "Dock, Sell, Upgrade",
    body: "Press Space near loot and ports. At port, sell cargo and buy hull reinforcement to survive longer runs."
  }
];

const LOW_PRIORITY_FADE_DELAY_MS = 2800;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getIslandLabel(worldState: WorldState, islandId: number | null): string {
  if (islandId === null) {
    return "Unknown isle";
  }
  return worldState.islands.find((island) => island.id === islandId)?.label ?? "Unknown isle";
}

function setVisibility(element: HTMLElement, visible: boolean, displayValue: "block" | "flex" = "block"): void {
  element.style.display = visible ? displayValue : "none";
}

export function createHud(root: HTMLElement, options: HudOptions): HudController {
  const target = options.target ?? window;
  const onboardingStorage = createOnboardingStorage(target);

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

  const mapsChip = document.createElement("span");
  mapsChip.className = "hud-chip";
  resourcesRow.appendChild(mapsChip);

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

  const objectiveStrip = document.createElement("section");
  objectiveStrip.className = "hud-panel hud-objective-strip";
  layer.appendChild(objectiveStrip);

  const eventLabel = document.createElement("div");
  eventLabel.className = "hud-event";
  objectiveStrip.appendChild(eventLabel);

  const objectiveLabel = document.createElement("div");
  objectiveLabel.className = "hud-objective";
  objectiveStrip.appendChild(objectiveLabel);

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
    '<span><i style="background:#ff6f62"></i>Enemy</span>' +
    '<span><i style="background:#fee59b"></i>Treasure</span>';
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

  const replayTutorialButton = document.createElement("button");
  replayTutorialButton.type = "button";
  replayTutorialButton.className = "pause-menu-secondary";
  replayTutorialButton.textContent = "Replay Tutorial";
  replayTutorialButton.setAttribute("data-testid", "replay-tutorial");
  pauseButtons.appendChild(replayTutorialButton);

  const resumeButton = document.createElement("button");
  resumeButton.type = "button";
  resumeButton.className = "pause-menu-primary";
  resumeButton.textContent = "Resume (Esc)";
  pauseButtons.appendChild(resumeButton);

  const onboardingBackdrop = document.createElement("div");
  onboardingBackdrop.className = "hud-modal-backdrop";
  layer.appendChild(onboardingBackdrop);

  const onboardingMenu = document.createElement("section");
  onboardingMenu.className = "onboarding-menu";
  onboardingMenu.setAttribute("data-testid", "onboarding-menu");
  layer.appendChild(onboardingMenu);

  const onboardingStepCounter = document.createElement("div");
  onboardingStepCounter.className = "onboarding-step";
  onboardingMenu.appendChild(onboardingStepCounter);

  const onboardingTitle = document.createElement("h2");
  onboardingMenu.appendChild(onboardingTitle);

  const onboardingBody = document.createElement("p");
  onboardingBody.className = "onboarding-body";
  onboardingMenu.appendChild(onboardingBody);

  const onboardingHint = document.createElement("p");
  onboardingHint.className = "onboarding-hint";
  onboardingHint.textContent = "Press Esc any time to close briefing.";
  onboardingMenu.appendChild(onboardingHint);

  const onboardingActions = document.createElement("div");
  onboardingActions.className = "onboarding-actions";
  onboardingMenu.appendChild(onboardingActions);

  const onboardingBack = document.createElement("button");
  onboardingBack.type = "button";
  onboardingBack.className = "onboarding-secondary";
  onboardingBack.textContent = "Back";
  onboardingActions.appendChild(onboardingBack);

  const onboardingSkip = document.createElement("button");
  onboardingSkip.type = "button";
  onboardingSkip.className = "onboarding-secondary";
  onboardingSkip.textContent = "Skip";
  onboardingActions.appendChild(onboardingSkip);

  const onboardingNext = document.createElement("button");
  onboardingNext.type = "button";
  onboardingNext.className = "onboarding-primary";
  onboardingActions.appendChild(onboardingNext);

  let dockMenuOpen = false;
  let pauseOpen = false;
  let onboardingStepIndex = 0;
  let onboardingVisible = !(onboardingStorage.load()?.completed ?? false);
  let uiLocked = false;
  let promptText = "";
  let promptPriority: PromptPriority = "hint";
  let promptChangedAt = target.performance.now();

  const syncUiLock = (): void => {
    const nextLock = dockMenuOpen || pauseOpen || onboardingVisible;
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

    setVisibility(onboardingBackdrop, onboardingVisible);
    setVisibility(onboardingMenu, onboardingVisible, "flex");

    syncUiLock();
  };

  const renderOnboardingStep = (): void => {
    const fallbackStep = ONBOARDING_STEPS[0]!;
    const currentStep = ONBOARDING_STEPS[onboardingStepIndex] ?? fallbackStep;
    onboardingStepCounter.textContent = `Step ${onboardingStepIndex + 1} / ${ONBOARDING_STEPS.length}`;
    onboardingTitle.textContent = currentStep.title;
    onboardingBody.textContent = currentStep.body;

    onboardingBack.disabled = onboardingStepIndex === 0;
    onboardingNext.textContent = onboardingStepIndex >= ONBOARDING_STEPS.length - 1 ? "Start Sailing" : "Next";
  };

  const closeOnboarding = (persistCompletion: boolean): void => {
    onboardingVisible = false;
    if (persistCompletion) {
      onboardingStorage.saveCompleted();
    }
    applyModalVisibility();
  };

  const openOnboarding = (): void => {
    pauseOpen = false;
    onboardingStepIndex = 0;
    onboardingVisible = true;
    renderOnboardingStep();
    applyModalVisibility();
  };

  const setPauseOpen = (open: boolean): void => {
    pauseOpen = open;
    applyModalVisibility();
  };

  replayTutorialButton.addEventListener("click", () => {
    openOnboarding();
  });

  resumeButton.addEventListener("click", () => {
    setPauseOpen(false);
  });

  onboardingBack.addEventListener("click", () => {
    if (onboardingStepIndex <= 0) {
      return;
    }
    onboardingStepIndex -= 1;
    renderOnboardingStep();
  });

  onboardingSkip.addEventListener("click", () => {
    closeOnboarding(true);
  });

  onboardingNext.addEventListener("click", () => {
    if (onboardingStepIndex >= ONBOARDING_STEPS.length - 1) {
      closeOnboarding(true);
      return;
    }
    onboardingStepIndex += 1;
    renderOnboardingStep();
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

    if (onboardingVisible) {
      closeOnboarding(true);
      return;
    }

    if (pauseOpen) {
      setPauseOpen(false);
      return;
    }

    setPauseOpen(true);
  };

  target.addEventListener("keydown", onKeyDown);

  renderOnboardingStep();
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
      mapsChip.textContent = `Maps ${worldState.wallet.treasureMaps}`;

      updateReloadCard(worldState.player.reload.left, leftReloadValue, leftReloadFill, leftReloadCard);
      updateReloadCard(worldState.player.reload.right, rightReloadValue, rightReloadFill, rightReloadCard);

      const eventTitle = formatEventLabel(worldState.eventDirector.activeKind);
      if (worldState.eventDirector.activeKind) {
        eventLabel.textContent = `${eventTitle}  ${Math.ceil(Math.max(0, worldState.eventDirector.remaining))}s`;
      } else {
        eventLabel.textContent = `${eventTitle}  next in ${Math.ceil(Math.max(0, worldState.eventDirector.timer))}s`;
      }

      if (worldState.treasureObjective.active) {
        const sourceLabel = worldState.treasureObjective.fromMap ? "map" : "world";
        objectiveLabel.textContent =
          `Objective (${sourceLabel}): Reach ${getIslandLabel(worldState, worldState.treasureObjective.targetIslandId)} and press Space (+${worldState.treasureObjective.rewardGold}g).`;
      } else if (worldState.wallet.gold >= worldState.upgrade.nextCost) {
        objectiveLabel.textContent = "Objective: Dock and buy Hull Reinforcement.";
      } else {
        objectiveLabel.textContent = worldState.eventDirector.statusText;
      }

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

