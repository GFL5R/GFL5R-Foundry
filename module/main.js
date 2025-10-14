import { registerActorSheets } from "./actors.js";
import { registerItemSheets } from "./items.js";

Hooks.once("init", () => {
  console.log("GFL5R | Initializing");

  Handlebars.registerHelper("object", function () {
    const out = {};
    for (let i = 0; i < arguments.length - 1; i += 2) out[arguments[i]] = arguments[i + 1];
    return out;
  });

  registerActorSheets();
  registerItemSheets();
});
