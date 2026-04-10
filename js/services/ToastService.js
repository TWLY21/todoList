export class ToastService {
  constructor(hostEl) {
    this.hostEl = hostEl;
  }

  push({ message, type = "info", actionLabel, onAction, duration = 3200 }) {
    if (!this.hostEl) return;

    const toast = document.createElement("article");
    toast.className = `toast ${type}`;

    const row = document.createElement("div");
    row.className = "toast-row";

    const messageEl = document.createElement("p");
    messageEl.className = "toast-message";
    messageEl.textContent = message;

    row.append(messageEl);

    let timer = null;

    if (actionLabel && typeof onAction === "function") {
      const actionBtn = document.createElement("button");
      actionBtn.type = "button";
      actionBtn.textContent = actionLabel;
      actionBtn.addEventListener("click", () => {
        if (timer) clearTimeout(timer);
        onAction();
        toast.remove();
      });
      row.append(actionBtn);
    }

    toast.append(row);
    this.hostEl.append(toast);

    timer = window.setTimeout(() => {
      toast.remove();
    }, duration);
  }
}
