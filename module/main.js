import { registerActorSheets } from "./actors.js";
import { registerItemSheets } from "./items.js";

Hooks.once("init", () => {
  console.log("GFL5R | Initializing");

  registerActorSheets();
  registerItemSheets();
});
