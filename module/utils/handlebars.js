// Central registration for Handlebars helpers
import { GFL5R_CONFIG } from "../config.js";

export function registerHandlebarsHelpers() {
  const hbs = Handlebars;
  if (!hbs) return;

  hbs.registerHelper("object", function () {
    const out = {};
    for (let i = 0; i < arguments.length - 1; i += 2) out[arguments[i]] = arguments[i + 1];
    return out;
  });

  hbs.registerHelper("capitalize", (s) => {
    const str = (s ?? "").toString();
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  hbs.registerHelper("eq", (a, b) => a === b);

  hbs.registerHelper("includes", (array, value) => Array.isArray(array) && array.includes(value));

  hbs.registerHelper("ifCond", function (v1, operator, v2, options) {
    const pass = (() => {
      switch (operator) {
        case "==": return v1 == v2;
        case "===": return v1 === v2;
        case "!=": return v1 != v2;
        case "!==": return v1 !== v2;
        case "<": return v1 < v2;
        case "<=": return v1 <= v2;
        case ">": return v1 > v2;
        case ">=": return v1 >= v2;
        case "&&": return Boolean(v1 && v2);
        case "||": return Boolean(v1 || v2);
        default: return false;
      }
    })();
    return pass ? options.fn(this) : options.inverse(this);
  });

  // Discipline helpers shared by actor sheets
  hbs.registerHelper("some", function (array, key) {
    if (!Array.isArray(array)) return false;
    return array.some((item) => item[key]);
  });

  hbs.registerHelper("count", function (array, key) {
    if (!Array.isArray(array)) return 0;
    return array.filter((item) => item[key]).length;
  });

  hbs.registerHelper("lt", (a, b) => a < b);
  hbs.registerHelper("add", (a, b) => (a || 0) + (b || 0));
  hbs.registerHelper("join", (arr, sep) => Array.isArray(arr) ? arr.join(sep ?? ", ") : "");
  hbs.registerHelper("isArray", (value) => Array.isArray(value));
  hbs.registerHelper("getNextEmptySlot", function (slots) {
    if (!Array.isArray(slots)) return "slot1";
    const empty = slots.find((slot) => !slot.discipline);
    return empty ? empty.slotKey : "slot1";
  });

  hbs.registerHelper("getDiceFaceUrl", function (diceClass, faceId) {
    const cls = game.gfl5r?.[diceClass];
    if (!cls || typeof cls.getResultSrc !== "function") return "";
    return cls.getResultSrc(faceId);
  });

  hbs.registerHelper("skillLabel", function (key) {
    if (!key) return "";
    return GFL5R_CONFIG.getSkillLabel?.(key) ?? key;
  });

  hbs.registerHelper("stanceLabel", function (key) {
    if (!key) return "";
    return GFL5R_CONFIG.getApproachLabel?.(key) ?? key;
  });

  // Compatibility helpers used by imported L5R5E templates
  hbs.registerHelper("localizeSkill", function (key /*, scope */) {
    if (!key) return "";
    return GFL5R_CONFIG.getSkillLabel?.(key) ?? key;
  });

  hbs.registerHelper("localizeRing", function (key) {
    if (!key) return "";
    return GFL5R_CONFIG.getApproachLabel?.(key) ?? key;
  });

  hbs.registerHelper("localizeSkillId", function (key) {
    if (!key) return "";
    return GFL5R_CONFIG.getSkillLabel?.(key) ?? key;
  });
}
