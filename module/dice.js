// module/dice.js
// Utility helpers to roll a single GFL5R ring (black d6) or skill (white d12) die.

const { randomID } = foundry.utils ?? {};
const systemId = () => game?.system?.id ?? CONFIG?.system?.id ?? "gfl5r";
const iconPath = (color, file) => `systems/${systemId()}/assets/dice/${color}/${file}`;

const buildFace = (type, key, label, { icon, s = 0, o = 0, r = 0, explosive = false } = {}) => ({
  type,
  key,
  label,
  icon,
  s,
  o,
  r,
  explosive
});

// Ring (approach) die faces — one face per side.
export const RING_DIE_FACES = [
  buildFace("ring", "blank", "Blank", { icon: iconPath("black", "blank.png") }),
  buildFace("ring", "opp-strife", "Opportunity + Strife", { icon: iconPath("black", "opp-strife.png"), o: 1, r: 1 }),
  buildFace("ring", "opp", "Opportunity", { icon: iconPath("black", "opp.png"), o: 1 }),
  buildFace("ring", "success-strife", "Success + Strife", { icon: iconPath("black", "success-strife.png"), s: 1, r: 1 }),
  buildFace("ring", "success", "Success", { icon: iconPath("black", "success.png"), s: 1 }),
  buildFace("ring", "explosive-strife", "Explosive Success + Strife", { icon: iconPath("black", "explosive-strife.png"), s: 1, r: 1, explosive: true })
];

// Skill die faces — duplicates reflect the 12 sides of the d12.
export const SKILL_DIE_FACES = [
  buildFace("skill", "blank", "Blank", { icon: iconPath("white", "blank.png") }),
  buildFace("skill", "blank", "Blank", { icon: iconPath("white", "blank.png") }),
  buildFace("skill", "opp", "Opportunity", { icon: iconPath("white", "opp.png"), o: 1 }),
  buildFace("skill", "opp", "Opportunity", { icon: iconPath("white", "opp.png"), o: 1 }),
  buildFace("skill", "opp", "Opportunity", { icon: iconPath("white", "opp.png"), o: 1 }),
  buildFace("skill", "success-strife", "Success + Strife", { icon: iconPath("white", "success-strife.png"), s: 1, r: 1 }),
  buildFace("skill", "success-strife", "Success + Strife", { icon: iconPath("white", "success-strife.png"), s: 1, r: 1 }),
  buildFace("skill", "success", "Success", { icon: iconPath("white", "success.png"), s: 1 }),
  buildFace("skill", "success", "Success", { icon: iconPath("white", "success.png"), s: 1 }),
  buildFace("skill", "success-opp", "Success + Opportunity", { icon: iconPath("white", "success-opp.png"), s: 1, o: 1 }),
  buildFace("skill", "explosive-strife", "Explosive Success + Strife", { icon: iconPath("white", "explosive-strife.png"), s: 1, r: 1, explosive: true }),
  buildFace("skill", "explosive", "Explosive Success", { icon: iconPath("white", "explosive.png"), s: 1, explosive: true })
];

const rollFace = (faces) => {
  const idx = Math.floor(Math.random() * faces.length);
  const face = faces[idx];
  const id = typeof randomID === "function" ? randomID() : crypto.randomUUID?.() ?? `die-${Date.now()}-${idx}`;
  return { ...face, id };
};

export const rollRingDie = () => rollFace(RING_DIE_FACES);
export const rollSkillDie = () => rollFace(SKILL_DIE_FACES);

export const rollDie = (type = "ring") => {
  if (type === "ring") return rollRingDie();
  if (type === "skill") return rollSkillDie();
  throw new Error(`Unknown die type: ${type}`);
};

console.log("GFL5R | dice.js loaded");
