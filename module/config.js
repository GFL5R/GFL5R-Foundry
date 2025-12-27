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

  // Skill catalog shared by sheets and item configs
  skillGroups: [
    {
      title: "Combat Skills",
      items: [
        { key: "blades", label: "Blades" },
        { key: "explosives", label: "Explosives" },
        { key: "exoticWeapons", label: "Exotic Weapons" },
        { key: "firearms", label: "Firearms" },
        { key: "handToHand", label: "Hand-To-Hand" },
        { key: "tactics", label: "Tactics" }
      ]
    },
    {
      title: "Fieldcraft Skills",
      items: [
        { key: "conditioning", label: "Conditioning" },
        { key: "resolve", label: "Resolve" },
        { key: "crafting", label: "Crafting" },
        { key: "stealth", label: "Stealth" },
        { key: "survival", label: "Survival" },
        { key: "insight", label: "Insight" }
      ]
    },
    {
      title: "Technical Skills",
      items: [
        { key: "computers", label: "Computers" },
        { key: "mechanics", label: "Mechanics" },
        { key: "medicine", label: "Medicine" },
        { key: "piloting", label: "Piloting" },
        { key: "science", label: "Science" },
        { key: "subterfuge", label: "Subterfuge" }
      ]
    },
    {
      title: "Social & Cultural Skills",
      items: [
        { key: "arts", label: "Arts" },
        { key: "command", label: "Command" },
        { key: "culture", label: "Culture" },
        { key: "deception", label: "Deception" },
        { key: "negotiation", label: "Negotiation" },
        { key: "performance", label: "Performance" }
      ]
    }
  ],

  // Initiative skills for different encounter types
  initiativeSkills: {
    intrigue: "insight",
    duel: "resolve",
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
  },

  getSkillLabel(key) {
    const safeKey = key ?? "";
    for (const group of this.skillGroups) {
      const match = group.items.find(item => item.key === safeKey);
      if (match) return match.label;
    }
    return safeKey;
  }
};
