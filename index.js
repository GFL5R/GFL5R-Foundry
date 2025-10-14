class GFL5RActorSheet extends ActorSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    // Classic Foundry tabs config (works in v12)
    return foundry.utils.mergeObject(opts, {
      classes: ["gfl5r", "sheet", "actor"],
      width: 640,
      height: 600,
      tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "skills" }]
    });
  }

  get template() {
    return "systems/gfl5r/templates/actor-sheet.html";
  }

  async getData(options) {
    const context = await super.getData(options);
    const data = context.actor.system ?? {};

    const power = data.approaches?.power ?? 0;
    const swiftness = data.approaches?.swiftness ?? 0;
    const resilience = data.approaches?.resilience ?? 0;
    const precision = data.approaches?.precision ?? 0;
    const fortune = data.approaches?.fortune ?? 0;

    context.derived = {
      endurance: (power + resilience) * 2,
      composure: (resilience + swiftness) * 2,
      vigilance: Math.ceil((precision + swiftness) / 2),
      focus: power + precision,
      fortunePointsMax: fortune,
      fortunePointsCurrent: Math.floor(fortune / 2)
    };

    // For convenience in template loops
    context.skills = data.skills ?? {};
    return context;
  }
}

Hooks.once("init", () => {
  console.log("GFL5R | Initializing");
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("gfl5r", GFL5RActorSheet, { makeDefault: true });
});
