export class AudioService {
  constructor() {
    this.audioContext = null;
  }

  updateToggleButton(button, enabled) {
    if (!button) return;
    button.textContent = enabled ? "Sound: On" : "Sound: Off";
    button.classList.toggle("is-off", !enabled);
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
    button.title = enabled ? "Turn sound off" : "Turn sound on";
  }

  play(kind, { enabled = true } = {}) {
    if (!enabled) return;

    if (kind === "create") {
      this.playTone({ frequency: 540, duration: 0.08, type: "triangle", gain: 0.028 });
      return;
    }

    if (kind === "complete") {
      this.playTone({ frequency: 690, duration: 0.08, type: "triangle", gain: 0.03 });
      window.setTimeout(() => this.playTone({ frequency: 860, duration: 0.12, type: "triangle", gain: 0.028 }), 60);
      return;
    }

    if (kind === "delete") {
      this.playTone({ frequency: 200, duration: 0.12, type: "sawtooth", gain: 0.02 });
      return;
    }

    if (kind === "restore") {
      this.playTone({ frequency: 430, duration: 0.08, type: "sine", gain: 0.025 });
      window.setTimeout(() => this.playTone({ frequency: 560, duration: 0.08, type: "sine", gain: 0.022 }), 50);
      return;
    }

    if (kind === "achievement") {
      this.playTone({ frequency: 760, duration: 0.1, type: "triangle", gain: 0.03 });
      window.setTimeout(() => this.playTone({ frequency: 950, duration: 0.14, type: "triangle", gain: 0.03 }), 70);
      return;
    }

    if (kind === "level-up") {
      this.playTone({ frequency: 600, duration: 0.1, type: "triangle", gain: 0.03 });
      window.setTimeout(() => this.playTone({ frequency: 900, duration: 0.12, type: "triangle", gain: 0.03 }), 70);
      window.setTimeout(() => this.playTone({ frequency: 1180, duration: 0.16, type: "triangle", gain: 0.035 }), 150);
    }
  }

  playTone({ frequency, duration = 0.1, type = "sine", gain = 0.03 }) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  getAudioContext() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;

    if (!this.audioContext) {
      this.audioContext = new Context();
    }

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }

    return this.audioContext;
  }
}
