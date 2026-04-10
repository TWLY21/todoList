import { ACHIEVEMENTS } from "../config/constants.js";
import { formatDateTime, formatDueDate, normalizeDueDate } from "../utils/dateUtils.js";
import { QuestStore } from "../store/QuestStore.js";
import { AchievementService } from "../services/AchievementService.js";
import { ToastService } from "../services/ToastService.js";
import { AudioService } from "../services/AudioService.js";
import { EffectsService } from "../services/EffectsService.js";

export class AppController {
  constructor() {
    this.form = document.querySelector("#quest-form");
    this.questInput = document.querySelector("#quest-input");
    this.difficultyInput = document.querySelector("#difficulty-input");
    this.dueInput = document.querySelector("#due-input");
    this.searchInput = document.querySelector("#search-input");
    this.sortInput = document.querySelector("#sort-input");
    this.filtersEl = document.querySelector("#filters");

    this.questListEl = document.querySelector("#quest-list");
    this.completedListEl = document.querySelector("#completed-list");
    this.achievementListEl = document.querySelector("#achievement-list");

    this.emptyStateEl = document.querySelector("#empty-state");
    this.completedEmptyEl = document.querySelector("#completed-empty");
    this.reorderHintEl = document.querySelector("#reorder-hint");

    this.levelValueEl = document.querySelector("#level-value");
    this.expLabelEl = document.querySelector("#exp-label");
    this.expFillEl = document.querySelector("#exp-fill");
    this.expTrackEl = document.querySelector(".exp-track");
    this.rankLabelEl = document.querySelector("#rank-label");
    this.currentStreakEl = document.querySelector("#current-streak");
    this.longestStreakEl = document.querySelector("#longest-streak");
    this.activeCountEl = document.querySelector("#active-count");
    this.completedCountEl = document.querySelector("#completed-count");
    this.overdueCountEl = document.querySelector("#overdue-count");
    this.footerStatsEl = document.querySelector("#footer-stats");
    this.liveDateEl = document.querySelector("#live-date");

    this.markAllActiveBtn = document.querySelector("#mark-all-active");
    this.markAllClearedBtn = document.querySelector("#mark-all-cleared");
    this.clearClearedBtn = document.querySelector("#clear-cleared");

    this.toastHostEl = document.querySelector("#toast-host");
    this.burstHostEl = document.querySelector("#burst-host");
    this.soundToggleBtn = document.querySelector("#sound-toggle");
    this.achievementPopupEl = document.querySelector("#achievement-popup");
    this.achievementPopupTitleEl = document.querySelector("#achievement-popup-title");
    this.achievementPopupDescEl = document.querySelector("#achievement-popup-desc");

    this.store = new QuestStore();
    this.achievementService = new AchievementService();
    this.toastService = new ToastService(this.toastHostEl);
    this.audioService = new AudioService();
    this.effectsService = new EffectsService({
      burstHostEl: this.burstHostEl,
      expTrackEl: this.expTrackEl
    });

    this.editingId = null;
    this.dragState = { dragId: null, targetId: null, placeBefore: true };
    this.undoState = { item: null, index: -1, timer: null };

    this.animationState = {
      entering: new Set(),
      cleared: new Set(),
      restored: new Set(),
      deleting: new Set()
    };

    this.achievementPopupTimer = null;
  }

  bootstrap() {
    this.bindEvents();
    this.bindKeyboardShortcuts();
    this.updateSoundToggleUI();
    this.evaluateAchievements({ notify: false });
    this.setLiveDate();
    window.setInterval(() => this.setLiveDate(), 10000);
    this.render();
  }

  bindEvents() {
    this.soundToggleBtn?.addEventListener("click", () => {
      const enabled = this.store.toggleSound();
      this.updateSoundToggleUI();

      if (enabled) {
        this.playSound("restore");
        this.pushToast({ message: "System audio enabled.", type: "success" });
        return;
      }

      this.pushToast({ message: "System audio muted.", type: "warning" });
    });

    this.form.addEventListener("submit", (event) => {
      event.preventDefault();

      const title = this.questInput.value.trim();
      if (!title) return;

      this.addQuest(title, this.difficultyInput.value, normalizeDueDate(this.dueInput.value));

      this.questInput.value = "";
      this.difficultyInput.value = "medium";
      this.dueInput.value = "";
      this.questInput.focus();
    });

    this.filtersEl.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-filter]");
      if (!button) return;

      this.store.setUIFilter(button.dataset.filter);
      this.render();
    });

    this.sortInput.addEventListener("change", () => {
      this.store.setUISort(this.sortInput.value);
      this.render();
    });

    this.searchInput.addEventListener("input", () => {
      this.store.setUISearch(this.searchInput.value);
      this.render();
    });

    this.markAllClearedBtn.addEventListener("click", () => {
      const result = this.store.markAllCleared();
      if (!result) return;

      this.evaluateAchievements({ notify: true });
      this.handleLevelProgress(result.previousLevel);
      this.render();
      this.pushToast({ message: "All missions marked as cleared.", type: "success" });
      this.playSound("complete");
    });

    this.markAllActiveBtn.addEventListener("click", () => {
      const changed = this.store.markAllActive();
      if (!changed) return;

      this.render();
      this.pushToast({ message: "All missions reset to active.", type: "warning" });
      this.playSound("restore");
    });

    this.clearClearedBtn.addEventListener("click", () => {
      const removed = this.store.clearCleared();
      if (!removed) {
        this.pushToast({ message: "No cleared missions to delete.", type: "info" });
        return;
      }

      this.render();
      this.pushToast({ message: `${removed} cleared mission(s) removed.`, type: "error" });
      this.playSound("delete");
    });

    this.questListEl.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;

      const card = event.target.closest(".quest-card");
      if (!card) return;

      const questId = card.dataset.id;
      const action = button.dataset.action;

      if (action === "toggle") {
        const quest = this.store.getState().quests.find((item) => item.id === questId);
        if (!quest) return;
        this.completeQuest(questId, !quest.completed);
        return;
      }

      if (action === "edit") {
        this.editingId = questId;
        this.render();
        return;
      }

      if (action === "cancel") {
        this.editingId = null;
        this.render();
        return;
      }

      if (action === "save") {
        const inputs = card.querySelectorAll(".edit-row input");
        const titleInputLocal = inputs[0];
        const dueInputLocal = inputs[1];
        if (!titleInputLocal) return;
        this.updateQuest(questId, titleInputLocal.value, dueInputLocal ? dueInputLocal.value : "");
        return;
      }

      if (action === "delete") {
        this.deleteQuestAnimated(questId);
      }
    });

    this.questListEl.addEventListener("dragstart", (event) => {
      const card = event.target.closest(".quest-card");
      if (!card || !this.isReorderEnabled()) {
        event.preventDefault();
        return;
      }

      this.dragState.dragId = card.dataset.id;
      this.dragState.targetId = null;
      this.dragState.placeBefore = true;

      card.classList.add("is-dragging");

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", this.dragState.dragId);
      }
    });

    this.questListEl.addEventListener("dragover", (event) => {
      if (!this.dragState.dragId || !this.isReorderEnabled()) return;

      event.preventDefault();
      const target = event.target.closest(".quest-card");
      if (!target || target.dataset.id === this.dragState.dragId) return;

      const rect = target.getBoundingClientRect();
      const placeBefore = event.clientY < rect.top + rect.height / 2;

      this.dragState.targetId = target.dataset.id;
      this.dragState.placeBefore = placeBefore;

      this.questListEl
        .querySelectorAll(".quest-card.drop-before, .quest-card.drop-after")
        .forEach((node) => node.classList.remove("drop-before", "drop-after"));

      target.classList.add(placeBefore ? "drop-before" : "drop-after");
    });

    this.questListEl.addEventListener("drop", (event) => {
      if (!this.dragState.dragId || !this.isReorderEnabled()) return;

      event.preventDefault();

      if (this.dragState.targetId && this.dragState.targetId !== this.dragState.dragId) {
        this.store.moveQuest(this.dragState.dragId, this.dragState.targetId, this.dragState.placeBefore);
        this.render();
        this.pushToast({ message: "Manual quest order updated.", type: "info" });
      }

      this.dragState = { dragId: null, targetId: null, placeBefore: true };
      this.clearDropMarkers();
    });

    this.questListEl.addEventListener("dragend", () => {
      this.dragState = { dragId: null, targetId: null, placeBefore: true };
      this.clearDropMarkers();
    });
  }

  bindKeyboardShortcuts() {
    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        this.searchInput.focus();
        this.searchInput.select();
        return;
      }

      if (this.isTypingField(event.target)) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        this.searchInput.focus();
        this.searchInput.select();
        return;
      }

      if (key === "n" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        this.questInput.focus();
        this.questInput.select();
      }
    });
  }

  isTypingField(target) {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
  }

  updateSoundToggleUI() {
    const enabled = Boolean(this.store.getState().settings?.soundEnabled);
    this.audioService.updateToggleButton(this.soundToggleBtn, enabled);
  }

  playSound(kind) {
    const enabled = Boolean(this.store.getState().settings?.soundEnabled);
    this.audioService.play(kind, { enabled });
  }

  pushToast(options) {
    this.toastService.push(options);
  }

  showAchievementPopup(achievement) {
    this.achievementPopupTitleEl.textContent = achievement.title;
    this.achievementPopupDescEl.textContent = achievement.description;
    this.achievementPopupEl.hidden = false;

    window.clearTimeout(this.achievementPopupTimer);
    this.achievementPopupTimer = window.setTimeout(() => {
      this.achievementPopupEl.hidden = true;
    }, 2800);
  }

  evaluateAchievements({ notify = true } = {}) {
    const { unlocked } = this.achievementService.evaluate(this.store);

    if (!notify || !unlocked.length) return;

    for (const achievement of unlocked) {
      this.pushToast({ message: `Achievement unlocked: ${achievement.title}`, type: "success" });
      this.showAchievementPopup(achievement);
      this.effectsService.spawnBurst({
        x: window.innerWidth / 2,
        y: 90,
        color: "var(--accent-3)",
        count: 24,
        spread: 180
      });
      this.playSound("achievement");
    }
  }

  handleLevelProgress(previousLevel) {
    const currentLevel = this.store.levelFromExp(this.store.getState().profile.exp);
    if (currentLevel <= previousLevel) return;

    this.effectsService.flashLevelUp();
    this.effectsService.spawnBurstFromElement(this.expTrackEl, {
      color: "var(--accent-2)",
      count: 28,
      spread: 190
    });
    this.playSound("level-up");
    this.pushToast({ message: `Level up! You reached Level ${currentLevel}.`, type: "success" });
  }

  isReorderEnabled() {
    const { ui } = this.store.getState();
    return ui.sort === "manual" && ui.filter === "all" && !ui.search.trim();
  }

  setAnimation(setName, id, duration = 500) {
    this.animationState[setName].add(id);
    window.setTimeout(() => {
      this.animationState[setName].delete(id);
      this.render();
    }, duration);
  }

  addQuest(title, difficulty, dueDate) {
    const quest = this.store.addQuest(title, difficulty, dueDate);
    if (!quest) return;

    const { ui } = this.store.getState();
    let switchedView = false;

    if (ui.filter !== "all") {
      this.store.setUIFilter("all");
      switchedView = true;
    }

    if (ui.search.trim()) {
      this.store.setUISearch("");
      switchedView = true;
    }

    this.setAnimation("entering", quest.id, 420);
    this.evaluateAchievements({ notify: true });
    this.render();

    this.pushToast({
      message: switchedView
        ? "Mission deployed. View reset to All so your new record is visible."
        : "Mission deployed.",
      type: "info"
    });
    this.playSound("create");
  }

  updateQuest(questId, title, dueDateRaw) {
    const updated = this.store.updateQuest(questId, title, dueDateRaw);
    if (!updated) return;

    this.editingId = null;
    this.render();
    this.pushToast({ message: "Mission updated.", type: "info" });
  }

  completeQuest(questId, nextCompleted) {
    const result = this.store.setQuestCompleted(questId, nextCompleted);
    if (!result) return;

    if (result.gainedExp) {
      this.setAnimation("cleared", questId, 520);
    }

    this.evaluateAchievements({ notify: true });
    this.handleLevelProgress(result.previousLevel);
    this.render();

    this.pushToast({
      message: nextCompleted ? "Quest cleared." : "Quest restored to active.",
      type: nextCompleted ? "success" : "warning"
    });
    this.playSound(nextCompleted ? "complete" : "restore");
  }

  deleteQuestAnimated(questId) {
    this.animationState.deleting.add(questId);
    this.render();

    window.setTimeout(() => {
      this.animationState.deleting.delete(questId);
      this.finalizeDeleteQuest(questId);
    }, 200);
  }

  finalizeDeleteQuest(questId) {
    const deleted = this.store.deleteQuestById(questId);
    if (!deleted) return;

    if (this.editingId === questId) {
      this.editingId = null;
    }

    if (this.undoState.timer) {
      clearTimeout(this.undoState.timer);
    }

    this.undoState = {
      item: deleted.item,
      index: deleted.index,
      timer: window.setTimeout(() => {
        this.undoState = { item: null, index: -1, timer: null };
      }, 5200)
    };

    this.render();
    this.playSound("delete");

    this.pushToast({
      message: "Mission deleted.",
      type: "error",
      actionLabel: "Undo",
      duration: 5200,
      onAction: () => {
        if (!this.undoState.item) return;

        this.store.restoreQuest(this.undoState.item, this.undoState.index);
        this.setAnimation("restored", this.undoState.item.id, 520);
        this.undoState = { item: null, index: -1, timer: null };

        this.render();
        this.pushToast({ message: "Mission restored.", type: "success" });
        this.playSound("restore");
        this.effectsService.spawnBurst({
          x: window.innerWidth - 120,
          y: window.innerHeight - 110,
          color: "var(--accent)",
          count: 16,
          spread: 120
        });
      }
    });
  }

  clearDropMarkers() {
    this.questListEl
      .querySelectorAll(".quest-card.drop-before, .quest-card.drop-after, .quest-card.is-dragging")
      .forEach((node) => node.classList.remove("drop-before", "drop-after", "is-dragging"));
  }

  createQuestCard(quest, { compact = false } = {}) {
    const li = document.createElement("li");
    li.className = "quest-card";
    li.dataset.id = quest.id;

    if (quest.completed) li.classList.add("is-cleared");
    if (this.store.isOverdue(quest)) li.classList.add("is-overdue");
    if (this.animationState.entering.has(quest.id)) li.classList.add("entering");
    if (this.animationState.cleared.has(quest.id)) li.classList.add("cleared-flash");
    if (this.animationState.restored.has(quest.id)) li.classList.add("restored");
    if (this.animationState.deleting.has(quest.id)) li.classList.add("deleting");

    li.draggable = !compact && this.isReorderEnabled() && this.editingId !== quest.id;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "quest-toggle";
    toggle.dataset.action = "toggle";
    toggle.setAttribute("aria-label", quest.completed ? "Mark as active" : "Mark as cleared");

    const main = document.createElement("div");
    main.className = "quest-main";

    const title = document.createElement("p");
    title.className = "quest-title";
    title.textContent = quest.title;

    const meta = document.createElement("p");
    meta.className = "quest-meta";

    const diff = document.createElement("span");
    diff.className = `badge ${quest.difficulty}`;
    diff.textContent = quest.difficulty;

    const exp = document.createElement("span");
    exp.className = "badge";
    exp.textContent = `${this.getDifficultyExp(quest.difficulty)} EXP`;

    const created = document.createElement("span");
    created.textContent = `Created ${formatDateTime(quest.createdAt)}`;

    meta.append(diff, exp, created);

    if (quest.dueDate) {
      const due = document.createElement("span");
      due.className = `badge ${this.store.isOverdue(quest) ? "overdue" : ""}`.trim();
      due.textContent = this.store.isOverdue(quest)
        ? `Overdue ${formatDueDate(quest.dueDate)}`
        : `Due ${formatDueDate(quest.dueDate)}`;
      meta.append(due);
    }

    if (quest.completedAt) {
      const cleared = document.createElement("span");
      cleared.textContent = `Cleared ${formatDateTime(quest.completedAt)}`;
      meta.append(cleared);
    }

    main.append(title, meta);
    li.append(toggle, main);

    if (this.editingId === quest.id && !compact) {
      const editRow = document.createElement("div");
      editRow.className = "edit-row";

      const titleInput = document.createElement("input");
      titleInput.value = quest.title;
      titleInput.maxLength = 120;

      const dueEdit = document.createElement("input");
      dueEdit.type = "date";
      dueEdit.value = quest.dueDate || "";

      const actions = document.createElement("div");
      actions.className = "edit-actions";
      actions.append(this.makeActionButton("Save", "save"), this.makeActionButton("Cancel", "cancel"));

      editRow.append(titleInput, dueEdit, actions);
      li.append(editRow);

      queueMicrotask(() => {
        titleInput.focus();
        titleInput.select();
      });

      titleInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.updateQuest(quest.id, titleInput.value, dueEdit.value);
        }
        if (event.key === "Escape") {
          this.editingId = null;
          this.render();
        }
      });

      return li;
    }

    if (!compact) {
      const actions = document.createElement("div");
      actions.className = "quest-actions";
      actions.append(
        this.makeActionButton("Edit", "edit"),
        this.makeActionButton("Delete", "delete", "delete")
      );
      li.append(actions);
    }

    return li;
  }

  makeActionButton(label, action, extraClass = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = action;
    button.className = `action-btn ${extraClass}`.trim();
    button.textContent = label;
    return button;
  }

  render() {
    const derived = this.store.getDerived();
    this.renderMissionStats(derived);
    this.renderFiltersAndControls();
    this.renderQuestBoards();
    this.renderAchievements(derived);
  }

  renderMissionStats(derived) {
    this.levelValueEl.textContent = String(derived.level);
    this.expLabelEl.textContent = `${derived.expInLevel} / 100 EXP`;
    this.expFillEl.style.width = `${derived.expInLevel}%`;
    this.expFillEl.parentElement?.setAttribute("aria-valuenow", String(derived.expInLevel));

    this.rankLabelEl.textContent = derived.rank;
    this.currentStreakEl.textContent = String(derived.streak.current);
    this.longestStreakEl.textContent = String(derived.streak.longest);
    this.activeCountEl.textContent = String(derived.active);
    this.completedCountEl.textContent = String(derived.completed);
    this.overdueCountEl.textContent = String(derived.overdue);

    this.footerStatsEl.textContent = `${derived.active} active | ${derived.completed} cleared | ${derived.overdue} overdue`;
  }

  renderFiltersAndControls() {
    const { ui } = this.store.getState();
    this.searchInput.value = ui.search;
    this.sortInput.value = ui.sort;

    this.filtersEl.querySelectorAll("button[data-filter]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.filter === ui.filter);
    });
  }

  renderQuestBoards() {
    const visible = this.store.filteredQuests();
    this.questListEl.innerHTML = "";

    for (const quest of visible) {
      this.questListEl.append(this.createQuestCard(quest));
    }

    this.emptyStateEl.style.display = visible.length ? "none" : "block";
    this.reorderHintEl.style.display = this.isReorderEnabled() ? "block" : "none";

    const completedItems = this.store
      .getState()
      .quests.filter((quest) => quest.completed)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 8);

    this.completedListEl.innerHTML = "";
    for (const quest of completedItems) {
      this.completedListEl.append(this.createQuestCard(quest, { compact: true }));
    }

    this.completedEmptyEl.style.display = completedItems.length ? "none" : "block";
  }

  renderAchievements(derived) {
    this.achievementListEl.innerHTML = "";

    for (const achievement of ACHIEVEMENTS) {
      const progress = achievement.progress(derived);
      const unlocked = this.store.hasAchievement(achievement.id);

      const li = document.createElement("li");
      li.className = `achievement-item ${unlocked ? "unlocked" : ""}`;

      const title = document.createElement("p");
      title.className = "achievement-title";
      title.textContent = achievement.title;

      const desc = document.createElement("p");
      desc.className = "achievement-desc";
      desc.textContent = achievement.description;

      const progressEl = document.createElement("p");
      progressEl.className = "achievement-progress";
      progressEl.textContent = unlocked
        ? "Unlocked"
        : `Progress: ${Math.min(progress, achievement.target)} / ${achievement.target}`;

      li.append(title, desc, progressEl);
      this.achievementListEl.append(li);
    }
  }

  setLiveDate() {
    this.liveDateEl.textContent = new Date().toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  getDifficultyExp(difficulty) {
    const value = {
      easy: 5,
      medium: 10,
      hard: 20
    };
    return value[difficulty] || 10;
  }
}
