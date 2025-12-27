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
        if (!Array.isArray(ids)) {
            ids = [ids];
        }

        // Get global modifiers
        const cfg = {
            difficulty: game.settings.get("gfl5r", "initiative-difficulty-value") || 1,
            difficultyHidden: game.settings.get("gfl5r", "initiative-difficulty-hidden") || false,
        };

        // Skill from DicePicker or global
        const skillId = messageOptions.skillId
            ? messageOptions.skillId
            : GFL5R_CONFIG.initiativeSkills[game.settings.get("gfl5r", "initiative-encounter") || "skirmish"];

        // Get score for each combatant
        const networkActors = [];
        const updatedCombatants = [];
        for (const combatantId of ids) {
            const combatant = game.combat.combatants.find((c) => c.id === combatantId);
            if (!combatant || !combatant.actor) {
                continue;
            }

            const actorSystem = combatant.actor.system;

            // A character's initiative value is based on their state of preparedness
            // For GFL5R, we'll use focus (derived from power + precision) as base initiative
            // If unprepared, use vigilance (derived from precision + swiftness)
            const isPrepared = game.settings.get("gfl5r", `initiative-prepared-${combatant.actor.type}`) || "true";
            let initiative = 0;

            if (isPrepared === "true") {
                // Prepared: use focus (power + precision)
                initiative = (actorSystem.approaches?.power || 0) + (actorSystem.approaches?.precision || 0);
            } else {
                // Unprepared: use vigilance (ceil((precision + swiftness) / 2))
                initiative = Math.ceil(((actorSystem.approaches?.precision || 0) + (actorSystem.approaches?.swiftness || 0)) / 2);
            }

            // Roll only for characters
            if (combatant.actor.type === "character") {
                // For initiative, open roll prompt first to allow approach selection
                const actorSystem = combatant.actor.system;
                const approaches = actorSystem.approaches ?? {};
                
                // Pre-select approach based on prepared state
                const isPrepared = game.settings.get("gfl5r", `initiative-prepared-${combatant.actor.type}`) || "true";
                let defaultApproach = "precision"; // default
                if (isPrepared === "false") {
                    defaultApproach = "swiftness";
                }

                // Render prompt
                const content = await renderTemplate(`systems/${game.system.id}/templates/roll-prompt.html`, {
                    approaches,
                    defaultTN: cfg.difficulty,
                    defaultApproach
                });

                // Wait for user input before proceeding
                const rollPromise = new Promise((resolve) => {
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
                                        actor: combatant.actor,
                                        skillKey: skillId,
                                        skillLabel: skillId.charAt(0).toUpperCase() + skillId.slice(1),
                                        approach: approachVal,
                                        approachName: approachName.charAt(0).toUpperCase() + approachName.slice(1),
                                        tn: tnHidden ? null : tnVal,
                                        hiddenTN: tnHidden,
                                        initiativeCombatantId: combatant.id,
                                        baseInitiative: initiative
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

                await rollPromise;
                
                // Don't update initiative here - it will be updated when the dice roller finishes
                updatedCombatants.push({
                    _id: combatant.id,
                    initiative: initiative, // Base initiative only, successes added later
                });
            }

            updatedCombatants.push({
                _id: combatant.id,
                initiative: initiative,
            });
        }

        // Update all combatants at once
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
