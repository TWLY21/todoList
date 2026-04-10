export const STORAGE_KEY = "quest.system.state.v1";
export const LEGACY_TASK_KEY = "momentum.tasks.v1";
export const LEGACY_UI_KEY = "momentum.tasks.ui.v1";

export const DIFFICULTY_EXP = {
  easy: 5,
  medium: 10,
  hard: 20
};

export const ACHIEVEMENTS = [
  {
    id: "discipline_initiated",
    title: "Discipline Initiated",
    description: "Create your first mission.",
    target: 1,
    progress: (derived) => derived.createdTotal
  },
  {
    id: "first_quest_cleared",
    title: "First Quest Cleared",
    description: "Complete your first mission.",
    target: 1,
    progress: (derived) => derived.lifetimeCompleted
  },
  {
    id: "five_tasks",
    title: "5 Tasks Completed",
    description: "Clear 5 missions.",
    target: 5,
    progress: (derived) => derived.lifetimeCompleted
  },
  {
    id: "ten_tasks",
    title: "10 Tasks Completed",
    description: "Clear 10 missions.",
    target: 10,
    progress: (derived) => derived.lifetimeCompleted
  },
  {
    id: "three_day_streak",
    title: "First 3-Day Streak",
    description: "Maintain a 3-day completion streak.",
    target: 3,
    progress: (derived) => derived.longestStreak
  },
  {
    id: "seven_day_streak",
    title: "7-Day Streak",
    description: "Maintain a 7-day completion streak.",
    target: 7,
    progress: (derived) => derived.longestStreak
  },
  {
    id: "task_master",
    title: "Task Master",
    description: "Reach 25 completed missions.",
    target: 25,
    progress: (derived) => derived.lifetimeCompleted
  }
];
