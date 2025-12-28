// module/combat.js
console.log("GFL5R | combat.js loaded");

import { GFL5R_CONFIG } from "./config.js";
import { GFLDicePickerDialog } from "./dice-picker-dialog.js";

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

            if (combatant.initiative !== null && combatant.initiative !== undefined) {
                ui.notifications?.warn(`Initiative already set for ${combatant.name}.`);
                continue;
            }

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
                const skillLabel = GFL5R_CONFIG.getSkillLabel?.(skillId) ?? skillId;

                await new Promise((resolve) => {
                    new GFLDicePickerDialog({
                        actor,
                        skillKey: skillId,
                        skillLabel,
                        approaches,
                        defaultTN: cfg.difficulty,
                        defaultApproach,
                        defaultHiddenTN: cfg.difficultyHidden,
                        lockHiddenTN: cfg.difficultyHidden,
                        isInitiativeRoll: true,
                        baseInitiative,
                        initiativeCombatantId: combatant.id,
                        onComplete: resolve
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
