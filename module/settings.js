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

    // Roll & Keep behavior
    game.settings.register("gfl5r", "rnk-deleteOldMessage", {
        name: "Delete previous Roll & Keep message",
        hint: "When enabled, replacing a roll via Roll & Keep will delete the previous chat message in the series.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
    });
}
