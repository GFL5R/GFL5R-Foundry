// Shared actor data and constants
import { GFL5R_CONFIG } from "./config.js";

export const APPROACH_LABELS = {
  power: "Power",
  swiftness: "Swiftness",
  resilience: "Resilience",
  precision: "Precision",
  fortune: "Fortune"
};

export const HUMAN_NATIONALITIES = [
  { key: "united-states", label: "United States", approaches: ["swiftness", "power"] },
  { key: "neo-soviet-union", label: "Neo-Soviet Union (NUSSR)", approaches: ["resilience", "power"] },
  { key: "china", label: "China", approaches: ["precision", "fortune"] },
  { key: "latin-america", label: "Latin America Alliance", approaches: ["precision", "power"] },
  { key: "japan", label: "Japan", approaches: ["resilience", "swiftness"] },
  { key: "pan-europe", label: "Pan-European Union", approaches: ["precision", "swiftness"] },
  { key: "yugoslavian-federation", label: "Yugoslavian Federation", approaches: ["fortune", "swiftness"] },
  { key: "north-african-union", label: "North African Union", approaches: ["precision", "resilience"] },
  { key: "australia", label: "Australia", approaches: ["fortune", "resilience"] },
  { key: "yellow-zone", label: "Yellow Zone Native", approaches: ["fortune", "power"] }
];

export const HUMAN_BACKGROUNDS = [
  { key: "military", label: "Military", approach: "resilience", skill: "tactics" },
  { key: "pmc-commander", label: "PMC Commander", approach: "power", skill: "command" },
  { key: "corporate-drone", label: "Corporate Drone", approach: "precision", skill: "negotiation" },
  { key: "scavenger", label: "Scavenger", approach: "swiftness", skill: "survival" },
  { key: "technician", label: "Technician", approach: "precision", skill: "mechanics" },
  { key: "medic", label: "Medic", approach: "resilience", skill: "medicine" },
  { key: "criminal", label: "Criminal", approach: "fortune", skill: "stealth" },
  { key: "scholar", label: "Scholar", approach: "swiftness", skill: "computers" }
];

export const TDOLL_FRAMES = [
  {
    key: "iop-ssd62",
    manufacturer: "IOP (Kyiv, Ukraine)",
    model: "SSD-62",
    description: "Designed as general-purpose companions, equally comfortable in a civilian home or a security detail.",
    approaches: { power: 2, swiftness: 2, resilience: 2, precision: 2, fortune: 2 },
    skills: ["firearms", "negotiation"]
  },
  {
    key: "iop-sst05",
    manufacturer: "IOP (Kyiv, Ukraine)",
    model: "SST-05",
    description: "Agile frontline combat Dolls, optimized for firearms and battlefield adaptability.",
    approaches: { power: 3, swiftness: 3, resilience: 2, precision: 2, fortune: 1 },
    skills: ["firearms", "tactics"]
  },
  {
    key: "svarog-crar",
    manufacturer: "Svarog Heavy Industries (Moscow, Russia)",
    model: "CRAR",
    description: "A heavy industrial frame retrofitted for combat. Strong, armored, and reliable, but sluggish compared to other Dolls.",
    approaches: { power: 3, swiftness: 1, resilience: 3, precision: 2, fortune: 1 },
    skills: ["conditioning", "mechanics"]
  },
  {
    key: "svarog-dmtx",
    manufacturer: "Svarog Heavy Industries (Moscow, Russia)",
    model: "DMT-X",
    description: "Originally designed to repair other Dolls in hazardous environments, these frames excel in precision tasks and technical support.",
    approaches: { power: 1, swiftness: 1, resilience: 3, precision: 4, fortune: 1 },
    skills: ["mechanics", "medicine"]
  },
  {
    key: "sangvis-dsi8",
    manufacturer: "Sangvis Ferri (Romania)",
    model: "DSI-8",
    description: "Infiltration frames optimized for deception and tactical operations. They can blend into human spaces surprisingly well, too.",
    approaches: { power: 2, swiftness: 2, resilience: 2, precision: 3, fortune: 1 },
    skills: ["stealth", "subterfuge"]
  },
  {
    key: "sangvis-ppd02",
    manufacturer: "Sangvis Ferri (Romania)",
    model: "PPD-02",
    description: "Originally a law enforcement design, later adapted for private security and paramilitary use. Balanced and authoritative, but rarely trusted outside official capacities.",
    approaches: { power: 1, swiftness: 2, resilience: 2, precision: 3, fortune: 2 },
    skills: ["insight", "command"]
  }
];

export const FLAVOR_DEFAULTS = {
  human: {
    step1: {
      lead1: "In the year 2070 most surviving Green Zones sit under the URNC, but people still hold onto nationality. Where you were born and raised shapes how others see you, and how you see the world.",
      lead2: "Every Commander begins with all Approaches at 1; your nationality grants +1 to two approaches."
    },
    step2: {
      lead1: "Your background defines what you did before bounty hunting-military halls, corporate desks, scavenger runs, or mercenary contracts. It grants +1 to one approach and sets one starting skill."
    },
    step3: {
      lead1: "Sooner or later you chose what kind of Commander you are. Select one Discipline-it's unlocked for you and becomes your starting slot.",
      lead2: "Drop your starting Discipline below; it will occupy slot 1."
    },
    advantage: "Drop one Advantage (Distinction). It's the quality that elevates you above the rest.",
    disadvantage: "Drop one Disadvantage (Adversity). It's the faultline that threatens to crack under pressure.",
    passion: "Drop one Passion. This is the habit, interest, or fixation that marks you as yourself.",
    anxiety: "Drop one Anxiety. It's the shadow you dread most.",
    viewDolls: "Your attitude shapes the bond. Respect makes them partners; seeing them as tools changes how you fight.",
    goal: "Choose a personal goal that drives your Commander.",
    nameMeaning: "Inherited, gifted, earned, or chosen?",
    storyEnd: "No mechanical effect-capture the vision you hold."
  }
};

export const flattenSkillList = () => {
  return GFL5R_CONFIG.skillGroups.flatMap(group => group.items.map(item => ({
    key: item.key,
    label: item.label
  })));
};
