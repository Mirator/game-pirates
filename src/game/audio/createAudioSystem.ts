import type { SimulationEvent, WorldEventKind } from "../simulation";

export interface MusicState {
  combatIntensity: number;
  menuOpen: boolean;
  activeEvent: WorldEventKind | null;
  stormActive: boolean;
}

export interface AudioSystem {
  handleEvents: (events: SimulationEvent[]) => void;
  syncMusic: (state: MusicState) => void;
  dispose: () => void;
}

interface MusicVoices {
  calmGain: GainNode;
  combatGain: GainNode;
  calmOscA: OscillatorNode;
  calmOscB: OscillatorNode;
  combatOscA: OscillatorNode;
  combatOscB: OscillatorNode;
  motionLfo: OscillatorNode;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate * 0.16, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function createAudioSystem(target: Window = window): AudioSystem {
  let context: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let sfxGain: GainNode | null = null;
  let musicGain: GainNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let musicVoices: MusicVoices | null = null;
  let audioUnlocked = false;

  const ensureContext = (allowCreate = false): AudioContext | null => {
    if (!context) {
      if (!allowCreate || !audioUnlocked) {
        return null;
      }
      const Ctor =
        globalThis.AudioContext ??
        (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        return null;
      }

      const createdContext = new Ctor();
      const createdMasterGain = createdContext.createGain();
      const createdSfxGain = createdContext.createGain();
      const createdMusicGain = createdContext.createGain();

      createdMasterGain.gain.value = 0.32;
      createdSfxGain.gain.value = 0.95;
      createdMusicGain.gain.value = 0.78;

      createdSfxGain.connect(createdMasterGain);
      createdMusicGain.connect(createdMasterGain);
      createdMasterGain.connect(createdContext.destination);

      context = createdContext;
      masterGain = createdMasterGain;
      sfxGain = createdSfxGain;
      musicGain = createdMusicGain;
      noiseBuffer = createNoiseBuffer(createdContext);
    }

    if (context && context.state === "suspended") {
      context.resume().catch(() => {});
    }

    return context;
  };

  const ensureMusicVoices = (allowCreate = false): MusicVoices | null => {
    const ctx = ensureContext(allowCreate);
    if (!ctx || !musicGain) {
      return null;
    }
    if (musicVoices) {
      return musicVoices;
    }

    const calmFilter = ctx.createBiquadFilter();
    calmFilter.type = "lowpass";
    calmFilter.frequency.value = 720;

    const combatFilter = ctx.createBiquadFilter();
    combatFilter.type = "bandpass";
    combatFilter.frequency.value = 380;
    combatFilter.Q.value = 0.7;

    const calmGain = ctx.createGain();
    const combatGain = ctx.createGain();
    calmGain.gain.value = 0.0001;
    combatGain.gain.value = 0.0001;

    const calmOscA = ctx.createOscillator();
    calmOscA.type = "triangle";
    calmOscA.frequency.value = 112;

    const calmOscB = ctx.createOscillator();
    calmOscB.type = "sine";
    calmOscB.frequency.value = 168;

    const combatOscA = ctx.createOscillator();
    combatOscA.type = "sawtooth";
    combatOscA.frequency.value = 90;

    const combatOscB = ctx.createOscillator();
    combatOscB.type = "square";
    combatOscB.frequency.value = 142;

    const motionLfo = ctx.createOscillator();
    motionLfo.type = "sine";
    motionLfo.frequency.value = 0.16;

    const calmLfoDepth = ctx.createGain();
    calmLfoDepth.gain.value = 12;
    const combatLfoDepth = ctx.createGain();
    combatLfoDepth.gain.value = 18;

    motionLfo.connect(calmLfoDepth);
    motionLfo.connect(combatLfoDepth);
    calmLfoDepth.connect(calmOscA.frequency);
    combatLfoDepth.connect(combatFilter.frequency);

    calmOscA.connect(calmFilter);
    calmOscB.connect(calmFilter);
    calmFilter.connect(calmGain);
    calmGain.connect(musicGain);

    combatOscA.connect(combatFilter);
    combatOscB.connect(combatFilter);
    combatFilter.connect(combatGain);
    combatGain.connect(musicGain);

    calmOscA.start();
    calmOscB.start();
    combatOscA.start();
    combatOscB.start();
    motionLfo.start();

    musicVoices = {
      calmGain,
      combatGain,
      calmOscA,
      calmOscB,
      combatOscA,
      combatOscB,
      motionLfo
    };

    return musicVoices;
  };

  const unlockAudio = (): void => {
    audioUnlocked = true;
    ensureContext(true);
    ensureMusicVoices(true);
  };

  target.addEventListener("pointerdown", unlockAudio, { passive: true });
  target.addEventListener("keydown", unlockAudio, { passive: true });

  const playTone = (
    frequency: number,
    duration: number,
    options?: {
      type?: OscillatorType;
      gain?: number;
      frequencyEnd?: number;
      attack?: number;
      delay?: number;
    }
  ): void => {
    const ctx = ensureContext();
    if (!ctx || !sfxGain) {
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + (options?.delay ?? 0);
    const attack = options?.attack ?? 0.01;
    const maxGain = options?.gain ?? 0.16;

    osc.type = options?.type ?? "triangle";
    osc.frequency.setValueAtTime(frequency, start);
    if (options?.frequencyEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(10, options.frequencyEnd), start + duration);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(maxGain, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(sfxGain);

    osc.start(start);
    osc.stop(start + duration + 0.02);
  };

  const playNoise = (duration: number, gainAmount: number, delay = 0): void => {
    const ctx = ensureContext();
    if (!ctx || !sfxGain || !noiseBuffer) {
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 430;

    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainAmount, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);

    source.start(start);
    source.stop(start + duration + 0.02);
  };

  return {
    handleEvents: (events) => {
      if (events.length === 0) {
        return;
      }

      for (const event of events) {
        switch (event.type) {
          case "cannon_fire":
            playTone(event.owner === "player" ? 118 : 96, 0.2, {
              type: "sawtooth",
              gain: 0.18,
              frequencyEnd: 58
            });
            playNoise(0.09, 0.11, 0.01);
            break;
          case "ship_hit":
            playTone(event.target === "player" ? 150 : 190, 0.12, {
              type: "square",
              gain: 0.09,
              frequencyEnd: 82
            });
            break;
          case "ship_sunk":
            playTone(event.owner === "player" ? 120 : 170, 0.44, {
              type: "sawtooth",
              gain: 0.12,
              frequencyEnd: 35
            });
            playNoise(0.28, 0.08, 0.02);
            break;
          case "loot_pickup":
            playTone(event.kind === "gold" ? 720 : 560, 0.09, {
              type: "triangle",
              gain: 0.08,
              frequencyEnd: event.kind === "gold" ? 880 : 700
            });
            break;
          case "dock_open":
            playTone(400, 0.12, { type: "triangle", gain: 0.07, frequencyEnd: 540 });
            break;
          case "dock_close":
            playTone(420, 0.12, { type: "triangle", gain: 0.07, frequencyEnd: 280 });
            break;
          case "repair_used":
            playTone(300, 0.17, { type: "sine", gain: 0.07, frequencyEnd: 500 });
            break;
          case "upgrade_purchased":
            playTone(520, 0.15, { type: "triangle", gain: 0.08, frequencyEnd: 680 });
            playTone(730, 0.18, { type: "triangle", gain: 0.08, frequencyEnd: 900, delay: 0.07 });
            break;
          case "treasure_collected":
            playTone(640, 0.14, { type: "triangle", gain: 0.09, frequencyEnd: 880 });
            playTone(840, 0.2, { type: "triangle", gain: 0.08, frequencyEnd: 1120, delay: 0.06 });
            break;
          case "world_event_started":
            if (event.kind === "storm") {
              playNoise(0.25, 0.07);
              playTone(220, 0.18, { type: "sawtooth", gain: 0.07, frequencyEnd: 130 });
            } else if (event.kind === "navy_patrol") {
              playTone(310, 0.18, { type: "square", gain: 0.07, frequencyEnd: 220 });
              playTone(230, 0.22, { type: "square", gain: 0.07, frequencyEnd: 160, delay: 0.09 });
            } else if (event.kind === "enemy_convoy") {
              playTone(280, 0.16, { type: "triangle", gain: 0.07, frequencyEnd: 360 });
            } else {
              playTone(460, 0.17, { type: "triangle", gain: 0.07, frequencyEnd: 560 });
            }
            break;
        }
      }
    },
    syncMusic: (state) => {
      const ctx = ensureContext();
      const voices = ensureMusicVoices();
      if (!ctx || !voices || !masterGain) {
        return;
      }

      let intensity = clamp(state.combatIntensity, 0, 1);
      if (state.activeEvent === "navy_patrol") {
        intensity = Math.max(intensity, 0.66);
      } else if (state.activeEvent === "enemy_convoy") {
        intensity = Math.max(intensity, 0.56);
      } else if (state.activeEvent === "storm" || state.stormActive) {
        intensity = Math.max(intensity, 0.5);
      }

      if (state.menuOpen) {
        intensity *= 0.35;
      }

      const calmTarget = clamp((1 - intensity) * 0.11, 0.015, 0.12);
      const combatTarget = clamp(intensity * 0.14, 0.003, 0.16);

      const now = ctx.currentTime;
      voices.calmGain.gain.setTargetAtTime(calmTarget, now, 0.35);
      voices.combatGain.gain.setTargetAtTime(combatTarget, now, 0.2);

      voices.calmOscA.frequency.setTargetAtTime(100 + (1 - intensity) * 18, now, 0.5);
      voices.calmOscB.frequency.setTargetAtTime(152 + (1 - intensity) * 26, now, 0.5);
      voices.combatOscA.frequency.setTargetAtTime(82 + intensity * 34, now, 0.28);
      voices.combatOscB.frequency.setTargetAtTime(134 + intensity * 46, now, 0.28);

      const masterTarget = state.menuOpen ? 0.28 : 0.32;
      masterGain.gain.setTargetAtTime(masterTarget, now, 0.4);
    },
    dispose: () => {
      target.removeEventListener("pointerdown", unlockAudio);
      target.removeEventListener("keydown", unlockAudio);

      if (musicVoices) {
        musicVoices.calmOscA.stop();
        musicVoices.calmOscB.stop();
        musicVoices.combatOscA.stop();
        musicVoices.combatOscB.stop();
        musicVoices.motionLfo.stop();
        musicVoices = null;
      }

      if (context && context.state !== "closed") {
        context.close().catch(() => {});
      }
    }
  };
}
