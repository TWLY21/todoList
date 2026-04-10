import {
  STORAGE_KEY,
  LEGACY_TASK_KEY,
  LEGACY_UI_KEY,
  DIFFICULTY_EXP
} from "../config/constants.js";
import { normalizeDueDate, todayKey } from "../utils/dateUtils.js";

function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class QuestStore {
  constructor() {
    this.state = this.loadState();
  }

  getState() {
    return this.state;
  }

  hasAchievement(achievementId) {
    return this.state.achievements.includes(achievementId);
  }

  addAchievement(achievementId) {
    if (this.state.achievements.includes(achievementId)) return false;
    this.state.achievements.push(achievementId);
    this.save();
    return true;
  }

  setUIFilter(filter) {
    this.state.ui.filter = filter;
    this.save();
  }

  setUISort(sort) {
    this.state.ui.sort = sort;
    this.save();
  }

  setUISearch(search) {
    this.state.ui.search = search;
    this.save();
  }

  toggleSound() {
    this.state.settings.soundEnabled = !this.state.settings.soundEnabled;
    this.save();
    return this.state.settings.soundEnabled;
  }

  addQuest(title, difficulty, dueDateRaw) {
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) return null;

    const quest = {
      id: uid(),
      title: cleanTitle,
      difficulty,
      dueDate: normalizeDueDate(dueDateRaw),
      completed: false,
      completedAt: null,
      expGranted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.state.quests.unshift(quest);
    this.state.profile.createdTotal += 1;
    this.save();
    return quest;
  }

  updateQuest(questId, title, dueDateRaw) {
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) return false;

    const dueDate = normalizeDueDate(dueDateRaw);
    const nowIso = new Date().toISOString();

    let updated = false;
    this.state.quests = this.state.quests.map((quest) => {
      if (quest.id !== questId) return quest;
      updated = true;
      return {
        ...quest,
        title: cleanTitle,
        dueDate,
        updatedAt: nowIso
      };
    });

    if (!updated) return false;
    this.save();
    return true;
  }

  setQuestCompleted(questId, nextCompleted) {
    const previousLevel = this.levelFromExp(this.state.profile.exp);
    const nowIso = new Date().toISOString();

    let changed = false;
    let gainedExp = false;

    this.state.quests = this.state.quests.map((quest) => {
      if (quest.id !== questId) return quest;
      changed = true;

      const updated = {
        ...quest,
        completed: nextCompleted,
        updatedAt: nowIso
      };

      if (nextCompleted) {
        updated.completedAt = updated.completedAt || nowIso;

        if (!updated.expGranted) {
          this.state.profile.exp += DIFFICULTY_EXP[updated.difficulty] || 10;
          updated.expGranted = true;
          gainedExp = true;
        }
      }

      return updated;
    });

    if (!changed) return null;

    this.save();
    return {
      changed,
      gainedExp,
      previousLevel,
      currentLevel: this.levelFromExp(this.state.profile.exp)
    };
  }

  deleteQuestById(questId) {
    const index = this.state.quests.findIndex((quest) => quest.id === questId);
    if (index < 0) return null;

    const [item] = this.state.quests.splice(index, 1);
    this.save();
    return { item, index };
  }

  restoreQuest(item, index) {
    if (!item) return false;

    const insertAt = Number.isInteger(index)
      ? Math.min(Math.max(index, 0), this.state.quests.length)
      : this.state.quests.length;

    this.state.quests.splice(insertAt, 0, item);
    this.save();
    return true;
  }

  moveQuest(dragId, targetId, placeBefore) {
    const from = this.state.quests.findIndex((quest) => quest.id === dragId);
    const targetRaw = this.state.quests.findIndex((quest) => quest.id === targetId);
    if (from < 0 || targetRaw < 0 || from === targetRaw) return false;

    const [moved] = this.state.quests.splice(from, 1);
    const target = from < targetRaw ? targetRaw - 1 : targetRaw;
    const insertAt = placeBefore ? target : target + 1;

    this.state.quests.splice(insertAt, 0, moved);
    this.save();
    return true;
  }

  markAllCleared() {
    if (!this.state.quests.length) return null;

    const previousLevel = this.levelFromExp(this.state.profile.exp);
    const nowIso = new Date().toISOString();
    let changed = false;

    this.state.quests = this.state.quests.map((quest) => {
      if (quest.completed) return quest;
      changed = true;

      const updated = {
        ...quest,
        completed: true,
        completedAt: quest.completedAt || nowIso,
        updatedAt: nowIso
      };

      if (!updated.expGranted) {
        this.state.profile.exp += DIFFICULTY_EXP[updated.difficulty] || 10;
        updated.expGranted = true;
      }

      return updated;
    });

    if (!changed) return { changed: false, previousLevel, currentLevel: previousLevel };

    this.save();
    return {
      changed,
      previousLevel,
      currentLevel: this.levelFromExp(this.state.profile.exp)
    };
  }

  markAllActive() {
    if (!this.state.quests.length) return false;

    const nowIso = new Date().toISOString();
    this.state.quests = this.state.quests.map((quest) => ({
      ...quest,
      completed: false,
      updatedAt: nowIso
    }));

    this.save();
    return true;
  }

  clearCleared() {
    const before = this.state.quests.length;
    this.state.quests = this.state.quests.filter((quest) => !quest.completed);
    const removed = before - this.state.quests.length;

    if (!removed) return 0;
    this.save();
    return removed;
  }

  filteredQuests() {
    const search = this.state.ui.search.trim().toLowerCase();
    const today = todayKey();

    const filtered = this.state.quests.filter((quest) => {
      const byFilter = (() => {
        if (this.state.ui.filter === "all") return true;
        if (this.state.ui.filter === "active") return !quest.completed;
        if (this.state.ui.filter === "completed") return quest.completed;
        if (this.state.ui.filter === "today") return !quest.completed && quest.dueDate === today;
        if (this.state.ui.filter === "upcoming") {
          return !quest.completed && quest.dueDate && quest.dueDate > today;
        }
        return true;
      })();

      const bySearch = !search || quest.title.toLowerCase().includes(search);
      return byFilter && bySearch;
    });

    this.sortQuests(filtered);
    return filtered;
  }

  isOverdue(quest) {
    return Boolean(quest.dueDate && !quest.completed && quest.dueDate < todayKey());
  }

  getDerived() {
    const active = this.state.quests.filter((quest) => !quest.completed).length;
    const completed = this.state.quests.filter((quest) => quest.completed).length;
    const overdue = this.state.quests.filter((quest) => this.isOverdue(quest)).length;
    const lifetimeCompleted = this.state.quests.filter((quest) => quest.expGranted).length;

    const level = this.levelFromExp(this.state.profile.exp);
    const expInLevel = this.state.profile.exp % 100;
    const rank = this.rankFromLevel(level);
    const streak = this.computeStreaks(this.state.quests);

    return {
      active,
      completed,
      overdue,
      lifetimeCompleted,
      level,
      expInLevel,
      rank,
      streak,
      createdTotal: this.state.profile.createdTotal
    };
  }

  levelFromExp(exp) {
    return Math.floor(exp / 100) + 1;
  }

  rankFromLevel(level) {
    if (level >= 16) return "S Rank";
    if (level >= 12) return "A Rank";
    if (level >= 8) return "B Rank";
    if (level >= 5) return "C Rank";
    if (level >= 3) return "D Rank";
    return "E Rank";
  }

  computeStreaks(quests) {
    const dates = new Set(
      quests
        .filter((quest) => quest.completedAt)
        .map((quest) => quest.completedAt.slice(0, 10))
    );

    if (!dates.size) {
      return { current: 0, longest: 0 };
    }

    const sorted = [...dates].sort();

    let longest = 1;
    let chain = 1;
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = new Date(`${sorted[i - 1]}T00:00:00`);
      const curr = new Date(`${sorted[i]}T00:00:00`);
      const diff = Math.round((curr - prev) / 86400000);
      if (diff === 1) {
        chain += 1;
        if (chain > longest) longest = chain;
      } else {
        chain = 1;
      }
    }

    const latest = sorted[sorted.length - 1];
    const latestDate = new Date(`${latest}T00:00:00`);
    const today = new Date(`${todayKey()}T00:00:00`);
    const gap = Math.round((today - latestDate) / 86400000);

    if (gap > 1) {
      return { current: 0, longest };
    }

    let current = 1;
    let cursor = latestDate;
    while (true) {
      const prev = new Date(cursor);
      prev.setDate(prev.getDate() - 1);
      const key = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
      if (!dates.has(key)) break;
      current += 1;
      cursor = prev;
    }

    return { current, longest };
  }

  sortQuests(items) {
    const difficultyWeight = { easy: 1, medium: 2, hard: 3 };

    if (this.state.ui.sort === "manual") return;

    if (this.state.ui.sort === "newest") {
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return;
    }

    if (this.state.ui.sort === "oldest") {
      items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      return;
    }

    if (this.state.ui.sort === "dueSoon") {
      items.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return new Date(b.createdAt) - new Date(a.createdAt);
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        if (a.dueDate === b.dueDate) return new Date(b.createdAt) - new Date(a.createdAt);
        return a.dueDate.localeCompare(b.dueDate);
      });
      return;
    }

    if (this.state.ui.sort === "difficulty") {
      items.sort((a, b) => {
        const byDifficulty = difficultyWeight[b.difficulty] - difficultyWeight[a.difficulty];
        if (byDifficulty !== 0) return byDifficulty;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      return;
    }

    if (this.state.ui.sort === "az") {
      items.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  loadState() {
    const fallback = {
      quests: [],
      ui: {
        filter: "all",
        sort: "manual",
        search: ""
      },
      profile: {
        exp: 0,
        createdTotal: 0
      },
      settings: {
        soundEnabled: true
      },
      achievements: []
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...fallback,
          ...parsed,
          ui: { ...fallback.ui, ...(parsed.ui || {}) },
          profile: { ...fallback.profile, ...(parsed.profile || {}) },
          settings: { ...fallback.settings, ...(parsed.settings || {}) },
          achievements: Array.isArray(parsed.achievements) ? parsed.achievements : []
        };
      }
    } catch {
      // Ignore parse errors and use fallback.
    }

    try {
      const legacyRaw = localStorage.getItem(LEGACY_TASK_KEY);
      const legacyUiRaw = localStorage.getItem(LEGACY_UI_KEY);
      const legacyTasks = legacyRaw ? JSON.parse(legacyRaw) : [];
      const legacyUi = legacyUiRaw ? JSON.parse(legacyUiRaw) : {};

      if (Array.isArray(legacyTasks) && legacyTasks.length) {
        const migrated = {
          ...fallback,
          quests: legacyTasks.map((task) => ({
            id: task.id || uid(),
            title: task.title || "Untitled mission",
            difficulty: task.priority === "high" ? "hard" : task.priority === "low" ? "easy" : "medium",
            dueDate: normalizeDueDate(task.dueDate),
            completed: Boolean(task.completed),
            expGranted: Boolean(task.expGranted || task.completed),
            completedAt: task.completedAt || (task.completed ? task.updatedAt || task.createdAt : null),
            createdAt: task.createdAt || new Date().toISOString(),
            updatedAt: task.updatedAt || task.createdAt || new Date().toISOString()
          })),
          ui: {
            filter: legacyUi.activeFilter || "all",
            sort: legacyUi.sortMode || "manual",
            search: legacyUi.searchQuery || ""
          }
        };

        migrated.profile.createdTotal = migrated.quests.length;
        migrated.profile.exp = migrated.quests
          .filter((quest) => quest.expGranted)
          .reduce((sum, quest) => sum + (DIFFICULTY_EXP[quest.difficulty] || 10), 0);

        return migrated;
      }
    } catch {
      // Ignore migration errors.
    }

    return fallback;
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }
}
