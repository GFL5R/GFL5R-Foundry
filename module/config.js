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
  getSkillsMap() {
    const map = new Map();
    this.skillGroups.forEach((group) => {
      group.items.forEach((item) => map.set(item.key, item));
    });
    return map;
  },
  getSkillCategoryLabel(id) {
    // For future category support; fallback to capitalize id
    return (id || "").charAt(0).toUpperCase() + (id || "").slice(1);
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
    for (const segment of this.disciplineXPPerRank) {
      if (xp < totalXP + segment) break;
      totalXP += segment;
      rank++;
    }
    return rank;
  },

  getSkillLabel(key = "") {
    for (const group of this.skillGroups) {
      const match = group.items.find(item => item.key === key);
      if (match) return match.label;
    }
    return key;
  },

  getApproachLabel(key) {
    const safe = (key || "").toString();
    return safe.charAt(0).toUpperCase() + safe.slice(1);
  }
};
