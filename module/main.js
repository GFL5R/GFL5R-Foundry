import { registerActorSheets } from "./actors.js";
import { registerItemSheets } from "./items.js";
import { GFL5RCombat } from "./combat.js";
import { registerSettings } from "./settings.js";
import { registerHandlebarsHelpers } from "./utils/handlebars.js";
import "./hooks.js";

Hooks.once("init", () => {
  console.log("GFL5R | Initializing");

  registerHandlebarsHelpers();

  // Register settings
  registerSettings();

  // Register custom combat class
  CONFIG.Combat.documentClass = GFL5RCombat;

  registerActorSheets();
  registerItemSheets();
});
