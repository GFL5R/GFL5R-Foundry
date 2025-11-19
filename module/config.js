// module/config.js
console.log("GFL5R | config.js loaded");

export const GFL5R_CONFIG = {
  // XP required to advance to each rank
  // Index 0 = rank 1, index 1 = rank 2, etc.
  disciplineXPPerRank: [
    20,  // Rank 1 → 2
    24,  // Rank 2 → 3
    32,  // Rank 3 → 4
  ],

  // Maximum number of discipline slots
  maxDisciplineSlots: 5,

  // Get XP required for next rank
  getXPForNextRank(currentRank) {
    if (currentRank < 1) return this.disciplineXPPerRank[0];
    if (currentRank > this.disciplineXPPerRank.length) return null;
    return this.disciplineXPPerRank[currentRank - 1];
  },

  // Calculate rank from XP
  getRankFromXP(xp) {
    let rank = 1;
    let totalXP = 0;
    for (let i = 0; i < this.disciplineXPPerRank.length; i++) {
      if (xp >= totalXP + this.disciplineXPPerRank[i]) {
        totalXP += this.disciplineXPPerRank[i];
        rank++;
      } else {
        break;
      }
    }
    return rank;
  }
};
