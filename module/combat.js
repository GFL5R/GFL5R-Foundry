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
                // DicePicker management
                if (!formula && !combatant.initiative) {
                    // For now, we'll skip the DicePicker and do a simple roll
                    // This can be enhanced later with a proper dice picker
                }

                // Roll formula
                const createFormula = [];
                if (!formula) {
                    // GFL5R uses d6 system, so we'll use 1d6 + approaches
                    createFormula.push("1d6");
                    const skillValue = actorSystem.skills?.[skillId] || 0;
                    if (skillValue > 0) {
                        createFormula.push(`${skillValue}`);
                    }
                }

                // For now, use a simple roll system
                const roll = new Roll(formula ?? createFormula.join("+"));
                await roll.roll();

                // If the character succeeded, add bonus successes
                const successes = roll.total >= cfg.difficulty ? 1 + Math.max(roll.total - cfg.difficulty, 0) : 0;
                initiative += successes;

                // Create a simple chat message
                const flavor = `Initiative Roll (${isPrepared === "true" ? "Prepared" : "Unprepared"})`;
                await roll.toMessage({ flavor });
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
