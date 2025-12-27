// module/combat.js
console.log("GFL5R | combat.js loaded");

import { GFL5R_CONFIG } from "./config.js";

export class GFL5RCombat extends Combat {
    /**
     * Roll initiative for one or multiple Combatants within the Combat entity
     * @param {string|string[]} ids     A Combatant id or Array of ids for which to roll
     * @param {string|null} [formula]   A non-default initiative formula to roll. Otherwise, the system default is used.
     * @param {boolean} [updateTurn]    Update the Combat turn after adding new initiative scores to keep the turn on
     *                                  the same Combatant.
     * @param {object} [messageOptions] Additional options with which to customize created Chat Messages
     * @return {Promise<Combat>}        A promise which resolves to the updated Combat entity once updates are complete.
     */
    async rollInitiative(ids, { formula = null, updateTurn = true, messageOptions = {} } = {}) {
        const targetIds = Array.isArray(ids) ? ids : [ids];

        const cfg = {
            difficulty: game.settings.get("gfl5r", "initiative-difficulty-value") || 1,
            difficultyHidden: game.settings.get("gfl5r", "initiative-difficulty-hidden") || false,
        };

        const encounter = game.settings.get("gfl5r", "initiative-encounter") || "skirmish";
        const skillId = messageOptions.skillId || GFL5R_CONFIG.initiativeSkills[encounter];

        const updatedCombatants = [];
        for (const combatantId of targetIds) {
            const combatant = this.combatants.get(combatantId);
            const actor = combatant?.actor;
            if (!combatant || !actor) continue;

            const approaches = actor.system?.approaches ?? {};
            const preparedFlag = actor.system?.prepared;
            const preparedSetting = game.settings.get("gfl5r", "initiative-prepared-character") || "true";
            const prepared = typeof preparedFlag === "boolean"
                ? preparedFlag
                : (preparedFlag === "true" ? true : (preparedFlag === "false" ? false : preparedSetting === "true"));

            const baseInitiative = prepared
                ? (approaches.power || 0) + (approaches.precision || 0)
                : Math.ceil(((approaches.precision || 0) + (approaches.swiftness || 0)) / 2);

            if (actor.type === "character") {
                const defaultApproach = prepared ? "precision" : "swiftness";

                const content = await renderTemplate(`systems/${game.system.id}/templates/roll-prompt.html`, {
                    approaches,
                    defaultTN: cfg.difficulty,
                    defaultApproach
                });

                await new Promise((resolve) => {
                    new Dialog({
                        title: `Initiative Roll for ${combatant.name}`,
                        content,
                        buttons: {
                            roll: {
                                label: "Roll Initiative",
                                callback: async (dlg) => {
                                    const form = dlg[0].querySelector("form");
                                    const approachName = form.elements["approach"].value;
                                    const tnHidden = form.elements["hiddenTN"].checked;
                                    const tnVal = Number(form.elements["tn"].value || cfg.difficulty);
                                    const approachVal = Number(approaches[approachName] ?? 0);

                                    const { GFLRollerApp } = await import("./dice.js");
                                    const app = new GFLRollerApp({
                                        actor,
                                        skillKey: skillId,
                                        skillLabel: skillId.charAt(0).toUpperCase() + skillId.slice(1),
                                        approach: approachVal,
                                        approachName: approachName.charAt(0).toUpperCase() + approachName.slice(1),
                                        tn: tnHidden ? null : tnVal,
                                        hiddenTN: tnHidden,
                                        initiativeCombatantId: combatant.id,
                                        baseInitiative,
                                    });
                                    await app.start();
                                    resolve();
                                }
                            },
                            cancel: {
                                label: "Cancel",
                                callback: () => resolve()
                            }
                        },
                        default: "roll"
                    }, {
                        classes: ["gfl5r", "gfl-roll-prompt"]
                    }).render(true);
                });
            }

            updatedCombatants.push({
                _id: combatant.id,
                initiative: baseInitiative,
            });
        }

        await this.updateEmbeddedDocuments("Combatant", updatedCombatants);
        return this;
    }

    /**
     * Define how the array of Combatants is sorted in the displayed list of the tracker.
     * This method can be overridden by a system or module which needs to display combatants in an alternative order.
     * By default, sort by initiative, falling back to name
     * @private
     */
    _sortCombatants(a, b) {
        // Sort by initiative, then by name
        if (a.initiative === b.initiative) {
            return a.name.localeCompare(b.name);
        }
        return b.initiative - a.initiative;
    }
}
