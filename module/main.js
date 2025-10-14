import { registerActorSheets } from "./actors.js";

Hooks.once("init", () => {
  console.log("GFL5R | Initializing");
  // Optional: expose a namespace for future use
  game.gfl5r ??= {};
  registerActorSheets();
});
