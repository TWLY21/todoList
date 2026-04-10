export class EffectsService {
  constructor({ burstHostEl, expTrackEl }) {
    this.burstHostEl = burstHostEl;
    this.expTrackEl = expTrackEl;
    this.levelFlashTimer = null;
  }

  spawnBurst({ x, y, color = "var(--accent)", count = 22, spread = 150 }) {
    if (!this.burstHostEl) return;

    const safeX = Number.isFinite(x) ? x : window.innerWidth / 2;
    const safeY = Number.isFinite(y) ? y : window.innerHeight / 2;

    for (let i = 0; i < count; i += 1) {
      const particle = document.createElement("span");
      particle.className = "burst";

      const angle = Math.random() * Math.PI * 2;
      const distance = spread * (0.35 + Math.random() * 0.75);
      const size = 5 + Math.random() * 5;

      particle.style.left = `${safeX}px`;
      particle.style.top = `${safeY}px`;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
      particle.style.background = `radial-gradient(circle at 30% 30%, #ffffff, ${color})`;

      this.burstHostEl.append(particle);
      window.setTimeout(() => particle.remove(), 760);
    }
  }

  spawnBurstFromElement(element, options = {}) {
    if (!element) {
      this.spawnBurst(options);
      return;
    }

    const rect = element.getBoundingClientRect();
    this.spawnBurst({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      ...options
    });
  }

  flashLevelUp() {
    if (!this.expTrackEl) return;

    this.expTrackEl.classList.add("level-up");
    window.clearTimeout(this.levelFlashTimer);
    this.levelFlashTimer = window.setTimeout(() => {
      this.expTrackEl.classList.remove("level-up");
    }, 900);
  }
}
