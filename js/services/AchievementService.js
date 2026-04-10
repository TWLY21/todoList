import { ACHIEVEMENTS } from "../config/constants.js";

export class AchievementService {
  constructor(achievements = ACHIEVEMENTS) {
    this.achievements = achievements;
  }

  getAchievements() {
    return this.achievements;
  }

  evaluate(store) {
    const derived = store.getDerived();
    const unlocked = [];

    for (const achievement of this.achievements) {
      if (store.hasAchievement(achievement.id)) continue;

      const progress = achievement.progress(derived);
      if (progress >= achievement.target && store.addAchievement(achievement.id)) {
        unlocked.push(achievement);
      }
    }

    return { derived, unlocked };
  }
}
