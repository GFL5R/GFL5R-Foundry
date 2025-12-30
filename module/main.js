import { registerActorSheets } from "./actors.js";
import { registerItemSheets } from "./items.js";
import { GFL5RCombat } from "./combat.js";
import { registerSettings } from "./settings.js";
import { registerDiceTerms } from "./dice.js";
import { RollnKeepDialog } from "./dialogs/roll-n-keep-dialog.js";
import { registerHandlebarsHelpers } from "./utils/handlebars.js";
import "./hooks.js";

Hooks.once("init", () => {
  console.log("GFL5R | Initializing");

  CONFIG.gfl5r ??= {};
  CONFIG.gfl5r.namespace = "gfl5r";

  // Helper/sockets used by the RNK dialog (adapted from l5r5e helpers)
  game.gfl5r ??= {};
  game.gfl5r._apps ??= new Map();
  game.gfl5r.helpers ??= {
    useGflSkills: () => true,
    getRollMode: (message) => message?.rolls?.[0]?.options?.rollMode ?? game.settings.get("core", "rollMode"),
    getApplication: (id) => game.gfl5r._apps.get(id) ?? Object.values(ui.windows ?? {}).find((w) => w.id === id),
    registerApplication: (app) => {
      if (app?.id) game.gfl5r._apps.set(app.id, app);
    },
    unregisterApplication: (id) => {
      if (!id) return;
      game.gfl5r._apps.delete(id);
    }
  };
  game.gfl5r.sockets ??= {
    updateMessageIdAndRefresh: (oldAppId, newMessageId) => {
      const app = game.gfl5r.helpers.getApplication(oldAppId);
      if (!app) return;
      const msg = game.messages?.get(newMessageId);
      if (msg) {
        app.message = msg;
        if (typeof app.refresh === "function") app.refresh();
        else app.render(false);
      }
    },
    deleteChatMessage: async (id) => {
      try {
        const msg = game.messages?.get(id);
        if (msg && (game.user.isGM || msg.isAuthor)) await msg.delete();
      } catch (err) {
        console.warn("GFL5R | deleteChatMessage failed", err);
      }
    }
  };

  registerHandlebarsHelpers();

  // Register settings
  registerSettings();

  // Register custom combat class
  CONFIG.Combat.documentClass = GFL5RCombat;

  registerActorSheets();
  registerItemSheets();
  registerDiceTerms();

  // Expose RNK dialog for later integration/chat actions
  game.gfl5r.RollnKeepDialog = RollnKeepDialog;
});
