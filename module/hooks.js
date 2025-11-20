// module/hooks.js
console.log("GFL5R | hooks.js loaded");

export class GFL5RHooks {
    static async renderCombatTracker(app, html, data) {
        // Display Combat bar (only for GMs)
        await this._gmCombatBar(app, $(html), data);
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
            duel: "centering",
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

        // Buttons Listeners
        html.find(".encounter-control").on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const encounter = $(event.currentTarget).data("id");
            if (!encounterTypeList.includes(encounter)) {
                return;
            }
            game.settings.set("gfl5r", "initiative-encounter", encounter);
        });

        html.find(".prepared-control").on("mousedown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const preparedId = $(event.currentTarget).data("id");
            if (!Object.hasOwnProperty.call(prepared, preparedId)) {
                return;
            }
            const rev = event.which === 3;
            const nextValue = {
                false: rev ? "true" : "actor",
                true: rev ? "actor" : "false",
                actor: rev ? "false" : "true",
            };
            game.settings.set("gfl5r", `initiative-prepared-${preparedId}`, nextValue[prepared[preparedId]]);
        });
    }
}

// Register hooks
Hooks.on("renderCombatTracker", GFL5RHooks.renderCombatTracker);
