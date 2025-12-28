import { registerActorSheets } from "./actors.js";
import { registerItemSheets } from "./items.js";
import { GFL5RCombat } from "./combat.js";
import { registerSettings } from "./settings.js";
import { registerDiceTerms } from "./dice.js";
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
  registerDiceTerms();
});

Hooks.once("ready", () => {
  game.socket?.on("system.gfl5r", async (payload) => {
    if (!payload || !payload.action) return;
    switch (payload.action) {
      case "rnk-refresh": {
        const msg = game.messages.get(payload.id);
        if (msg) {
          try {
            await msg.render(false);
          } catch (err) {
            console.warn("GFL5R | Unable to refresh chat message", err);
          }
        }
        // Refresh any open Roll & Keep dialog for this message (cache + open windows)
        const refreshDlg = async (dlg) => {
          if (payload.strifeApplied !== undefined && dlg?.roll?.gfl5r) {
            dlg.roll.gfl5r.strifeApplied = payload.strifeApplied;
          }
          if (dlg?.refresh) {
            try {
              await dlg.refresh();
            } catch (err) {
              console.warn("GFL5R | Unable to refresh Roll & Keep dialog", err);
            }
          }
        };

        const cache = game.gfl5r?._rnkCache || {};
        for (const [mid, dlg] of Object.entries(cache)) {
          if (payload.id && mid !== payload.id) continue;
          await refreshDlg(dlg);
        }

        // Also iterate open windows in case not cached locally
        for (const wnd of Object.values(ui.windows)) {
          if (payload.id && wnd?.message?.id !== payload.id) continue;
          if (wnd && wnd.constructor?.name === "RollnKeepDialog") {
            await refreshDlg(wnd);
          }
        }
        break;
      }
    }
  });
});
