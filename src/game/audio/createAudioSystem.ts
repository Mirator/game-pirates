import type { SimulationEvent } from "../simulation";

export interface AudioSystem {
  handleEvents: (events: SimulationEvent[]) => void;
  dispose: () => void;
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate * 0.15, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function createAudioSystem(target: Window = window): AudioSystem {
  let context: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;

  const ensureContext = (): AudioContext | null => {
    if (!context) {
      const Ctor =
        globalThis.AudioContext ??
        (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        return null;
      }
      const createdContext = new Ctor();
      const createdMasterGain = createdContext.createGain();
      createdMasterGain.gain.value = 0.32;
      createdMasterGain.connect(createdContext.destination);
      context = createdContext;
      masterGain = createdMasterGain;
      noiseBuffer = createNoiseBuffer(createdContext);
    }

    const activeContext = context;
    if (activeContext && activeContext.state === "suspended") {
      activeContext.resume().catch(() => {});
    }

    return activeContext;
  };

  const unlockAudio = (): void => {
    ensureContext();
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
    if (!ctx || !masterGain) {
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
    gain.connect(masterGain);

    osc.start(start);
    osc.stop(start + duration + 0.02);
  };

  const playNoise = (duration: number, gainAmount: number, delay = 0): void => {
    const ctx = ensureContext();
    if (!ctx || !masterGain || !noiseBuffer) {
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 450;

    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainAmount, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

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
        }
      }
    },
    dispose: () => {
      target.removeEventListener("pointerdown", unlockAudio);
      target.removeEventListener("keydown", unlockAudio);
      if (context && context.state !== "closed") {
        context.close().catch(() => {});
      }
    }
  };
}
