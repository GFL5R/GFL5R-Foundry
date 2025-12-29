// Facade for dice-related exports
import { PATHS } from "./dice-constants.js";
import { L5rBaseDie, RingDie, AbilityDie, RollGFL5R, patchRollFromData } from "./rolls/roll-gfl5r.js";
import { RollnKeepDialog } from "./dialogs/roll-n-keep.js";

// Ensure Roll.fromData is patched early
patchRollFromData();

export function registerDiceTerms() {
  CONFIG.Dice.terms ??= {};
  CONFIG.Dice.terms["r"] = RingDie;
  CONFIG.Dice.terms["s"] = AbilityDie;
  if (!Array.isArray(CONFIG.Dice.rolls)) {
    CONFIG.Dice.rolls = [];
  }
  if (!CONFIG.Dice.rolls.includes(RollGFL5R)) {
    CONFIG.Dice.rolls.push(RollGFL5R);
  }
  // also support legacy object-style lookup used by some modules
  CONFIG.Dice.rolls[RollGFL5R.name] = RollGFL5R;
  CONFIG.Dice.rolls["RollGFL5R"] = RollGFL5R;
  CONFIG.Dice.rolls["rollgfl5r"] = RollGFL5R;

  CONFIG.gfl5r = CONFIG.gfl5r || {};
  CONFIG.gfl5r.paths = PATHS;

  game.gfl5r = game.gfl5r || {};
  game.gfl5r.L5rBaseDie = L5rBaseDie;
  game.gfl5r.RingDie = RingDie;
  game.gfl5r.AbilityDie = AbilityDie;
  game.gfl5r.RollGFL5R = RollGFL5R;
  game.gfl5r.RollnKeepDialog = RollnKeepDialog;

  // Ensure Roll.fromData patch exists
  patchRollFromData();
}

export { PATHS, L5rBaseDie, RingDie, AbilityDie, RollGFL5R, RollnKeepDialog };

console.log("GFL5R | dice.js facade loaded");
