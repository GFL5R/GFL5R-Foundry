// module/config.js
console.log("GFL5R | config.js loaded");

export const GFL5R_CONFIG = {
  // XP required to advance to each rank
  // Index 0 = rank 1, index 1 = rank 2, etc.
  disciplineXPPerRank: [
    16,
    20,
    24
  ],

  // Maximum number of discipline slots
  maxDisciplineSlots: 5,

  // Initiative skills for different encounter types
  initiativeSkills: {
    intrigue: "insight",
    duel: "centering",
    skirmish: "tactics",
    mass_battle: "command",
  },

  // Get total XP required to reach next rank (cumulative)
  getXPForNextRank(currentRank) {
    if (currentRank < 1) return this.disciplineXPPerRank[0];
    if (currentRank > this.disciplineXPPerRank.length) return null;
    
    // Calculate cumulative XP needed
    let totalXP = 0;
    for (let i = 0; i < currentRank; i++) {
      totalXP += this.disciplineXPPerRank[i];
    }
    return totalXP;
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
