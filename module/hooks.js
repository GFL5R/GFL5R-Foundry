// module/hooks.js
console.log("GFL5R | hooks.js loaded");

export class GFL5RHooks {
    static async renderCombatTracker(app, html, data) {
        // Display Combat bar (only for GMs)
        await GFL5RHooks._gmCombatBar(app, $(html), data);
    }

    static renderChatMessageHTML(message, html, data) {
        if (!html) return;
        const root = html instanceof HTMLElement ? html : (html[0] || html);
        const $root = root instanceof jQuery ? root : $(root);

        if (message.isRoll) {
            $root.addClass("roll");

            if (game.user.isGM) {
                $root.find(".player-only").remove();
            } else {
                $root.find(".gm-only").remove();
            }
        }
    }

    /**
     * Display a GM bar for Combat/Initiative
     * @private
     */
    static async _gmCombatBar(app, html, data) {
        // Only for GMs
        if (!game.user.isGM) {
            return;
        }

        html = $(html); // basic patch for v13

        // *** Conf ***
        const encounterTypeList = Object.keys(game.gfl5r?.initiativeSkills || {
            intrigue: "insight",
            duel: "resolve",
            skirmish: "tactics",
            mass_battle: "command",
        });
        const prepared = {
            character: game.settings.get("gfl5r", "initiative-prepared-character") || "true",
        };

        // *** Template ***
        const tpl = await foundry.applications.handlebars.renderTemplate(`systems/gfl5r/templates/gm/combat-tracker-bar.html`, {
            encounterType: game.settings.get("gfl5r", "initiative-encounter") || "skirmish",
            encounterTypeList,
            prepared,
        });

        // Add/replace in bar
        const elmt = html.find("#gfl5r_gm_combat_tracker_bar");
        if (elmt.length > 0) {
            elmt.replaceWith(tpl);
        } else {
            html.find(".combat-tracker-header").append(tpl);
        }

        // Dropdown Listeners
        html.find("#encounter-type-select").on("change", (event) => {
            const encounter = $(event.currentTarget).val();
            if (!encounterTypeList.includes(encounter)) {
                return;
            }
            game.settings.set("gfl5r", "initiative-encounter", encounter);
        });

        html.find("#prepared-select").on("change", (event) => {
            const preparedValue = $(event.currentTarget).val();
            game.settings.set("gfl5r", "initiative-prepared-character", preparedValue);
        });
    }
}

// Register hooks
Hooks.on("renderCombatTracker", GFL5RHooks.renderCombatTracker);
Hooks.on("renderChatMessageHTML", GFL5RHooks.renderChatMessageHTML);

Hooks.on("createItem", async (item, options, userId) => {
  if (item.parent instanceof Actor && item.type === "module") {
    await applyModuleEffect(item.parent, item);
  }
});

Hooks.on("deleteItem", async (item, options, userId) => {
  if (item.parent instanceof Actor && item.type === "module") {
    await removeModuleEffect(item.parent, item);
  }
});

async function applyModuleEffect(actor, item) {
  const moduleType = item.system.moduleType;
  if (moduleType === "skillIncrease" && item.system.targetSkill) {
    const current = actor.system.skills[item.system.targetSkill] || 0;
    await actor.update({ [`system.skills.${item.system.targetSkill}`]: current + 1 });
  } else if (moduleType === "approachIncrease" && item.system.targetApproach) {
    const current = actor.system.approaches[item.system.targetApproach] || 0;
    await actor.update({ [`system.approaches.${item.system.targetApproach}`]: current + 1 });
  }
}

async function removeModuleEffect(actor, item) {
  const moduleType = item.system.moduleType;
  if (moduleType === "skillIncrease" && item.system.targetSkill) {
    const current = actor.system.skills[item.system.targetSkill] || 0;
    await actor.update({ [`system.skills.${item.system.targetSkill}`]: Math.max(0, current - 1) });
  } else if (moduleType === "approachIncrease" && item.system.targetApproach) {
    const current = actor.system.approaches[item.system.targetApproach] || 0;
    await actor.update({ [`system.approaches.${item.system.targetApproach}`]: Math.max(0, current - 1) });
  }
}
