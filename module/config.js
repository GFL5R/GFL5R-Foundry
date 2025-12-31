// module/config.js
console.log("GFL5R | config.js loaded");

const normalizeId = (id) => (id ?? "").toString().trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
const capitalize = (val) => {
  const safe = (val ?? "").toString();
  return safe.charAt(0).toUpperCase() + safe.slice(1);
};
const localize = (key, fallback = undefined) => {
  const localized = game?.i18n?.localize?.(key);
  if (localized && localized !== key) return localized;
  return fallback;
};

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

  skillCategories: {
    combat: "Combat Skills",
    "combat-skills": "Combat Skills",
    fieldcraft: "Fieldcraft Skills",
    "fieldcraft-skills": "Fieldcraft Skills",
    technical: "Technical Skills",
    "technical-skills": "Technical Skills",
    social: "Social & Cultural Skills",
    culture: "Social & Cultural Skills",
    "social-cultural-skills": "Social & Cultural Skills",
  },

  // Approach/ring labels (player + NPC friendly)
  approachLabels: {
    power: "Power",
    swiftness: "Swiftness",
    resilience: "Resilience",
    precision: "Precision",
    fortune: "Fortune",
  },

  // Optional alt ring labels; falls back to approachLabels/capitalization
  ringLabels: {
    air: "Air",
    earth: "Earth",
    fire: "Fire",
    water: "Water",
    void: "Void",
    ring: "Ring"
  },

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
      const groupId = normalizeId(group.title);
      group.items.forEach((item) => map.set(item.key, { ...item, group: group.title, groupId }));
    });
    return map;
  },
  getSkillCategoryLabel(id) {
    const slug = normalizeId(id);
    if (!slug) return "";
    const i18nKey = `GFL5R.SkillCategory.${slug}`;
    const loc = localize(i18nKey, null);
    if (loc) return loc;
    if (this.skillCategories?.[slug]) return this.skillCategories[slug];
    const fromGroup = this.skillGroups.find((group) => normalizeId(group.title) === slug);
    if (fromGroup) return fromGroup.title;
    return capitalize(id);
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
    for (const cost of this.disciplineXPPerRank) {
      if (xp < totalXP + cost) break;
      totalXP += cost;
      rank++;
    }
    return rank;
  },

  getSkillLabel(key = "") {
    const map = this.getSkillsMap();
    const found = map.get(key);
    if (found?.label) return found.label;
    return capitalize(key);
  },

  getApproachLabel(key) {
    const slug = normalizeId(key);
    if (!slug) return "";
    const loc = localize(`GFL5R.Approach.${slug}`, null);
    if (loc) return loc;
    if (this.approachLabels?.[slug]) return this.approachLabels[slug];
    if (this.ringLabels?.[slug]) return this.ringLabels[slug];
    return capitalize(key);
  },

  getRingLabel(key) {
    const slug = normalizeId(key);
    if (!slug) return "";
    const loc = localize(`GFL5R.Ring.${slug}`, null);
    if (loc) return loc;
    if (this.ringLabels?.[slug]) return this.ringLabels[slug];
    return this.getApproachLabel(key);
  }
};
