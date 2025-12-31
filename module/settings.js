// module/settings.js
console.log("GFL5R | settings.js loaded");

export function registerSettings() {
    // Initiative Roll Dialog (GM only)
    game.settings.register("gfl5r", "initiative-difficulty-hidden", {
        name: "Initiative difficulty is hidden",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
    });

    game.settings.register("gfl5r", "initiative-difficulty-value", {
        name: "Initiative difficulty value",
        scope: "world",
        config: false,
        type: Number,
        default: 1,
    });

    game.settings.register("gfl5r", "initiative-encounter", {
        name: "Initiative encounter type",
        scope: "world",
        config: false,
        type: String,
        default: "skirmish",
        onChange: () => {
            ui.combat.render(true);
        },
    });

    game.settings.register("gfl5r", "initiative-prepared-character", {
        name: "Initiative PC prepared or not",
        scope: "world",
        config: false,
        type: String,
        default: "true",
    });

    // Character Builder Settings
    game.settings.register("gfl5r", "chargen-max-credits", {
        name: "Character Builder: Maximum Starting Credits",
        hint: "The maximum URNC credits available for purchasing modules during character creation.",
        scope: "world",
        config: true,
        type: Number,
        default: 60000,
    });

    game.settings.register("gfl5r", "chargen-max-commander-item-rarity", {
        name: "Character Builder: Maximum Commander Item Rarity",
        hint: "The maximum rarity allowed for the free item chosen in T-Doll Question 8.",
        scope: "world",
        config: true,
        type: Number,
        default: 7,
    });

    game.settings.register("gfl5r", "chargen-max-weird-module-credits", {
        name: "Character Builder: Maximum Weird Name Module Credits",
        hint: "The maximum credits allowed for the free module chosen with the Weird Name bonus.",
        scope: "world",
        config: true,
        type: Number,
        default: 6000,
    });
}
