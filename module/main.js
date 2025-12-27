import { registerActorSheets } from "./actors.js";
import { registerItemSheets } from "./items.js";
import { GFL5RCombat } from "./combat.js";
import { registerSettings } from "./settings.js";
import { registerDiceTerms } from "./dice.js";
import "./hooks.js";

Hooks.once("init", () => {
  console.log("GFL5R | Initializing");

  Handlebars.registerHelper("object", function () {
    const out = {};
    for (let i = 0; i < arguments.length - 1; i += 2) out[arguments[i]] = arguments[i + 1];
    return out;
  });

  Handlebars.registerHelper("capitalize", (s) => {
    s = (s ?? "").toString();
    return s.charAt(0).toUpperCase() + s.slice(1);
  });

  Handlebars.registerHelper("eq", (a, b) => a === b);

  Handlebars.registerHelper("ifCond", function(v1, operator, v2, options) {
    switch (operator) {
      case '==':
        return (v1 == v2) ? options.fn(this) : options.inverse(this);
      case '===':
        return (v1 === v2) ? options.fn(this) : options.inverse(this);
      case '!=':
        return (v1 != v2) ? options.fn(this) : options.inverse(this);
      case '!==':
        return (v1 !== v2) ? options.fn(this) : options.inverse(this);
      case '<':
        return (v1 < v2) ? options.fn(this) : options.inverse(this);
      case '<=':
        return (v1 <= v2) ? options.fn(this) : options.inverse(this);
      case '>':
        return (v1 > v2) ? options.fn(this) : options.inverse(this);
      case '>=':
        return (v1 >= v2) ? options.fn(this) : options.inverse(this);
      case '&&':
        return (v1 && v2) ? options.fn(this) : options.inverse(this);
      case '||':
        return (v1 || v2) ? options.fn(this) : options.inverse(this);
      default:
        return options.inverse(this);
    }
  });

  // Register settings
  registerSettings();

  // Register custom combat class
  CONFIG.Combat.documentClass = GFL5RCombat;

  registerActorSheets();
  registerItemSheets();
  registerDiceTerms();
});
