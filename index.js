class GFL5RActorSheet extends ActorSheet {
  get template() {
    return "systems/gfl5r/templates/actor-sheet.html";
  }

  /** v12-friendly: super.getData() is async */
  async getData(options) {
    const context = await super.getData(options);
    const data = context.actor.system ?? {};

    // Approaches (default to 0 if unset)
    const power = data.approaches?.power ?? 0;
    const swiftness = data.approaches?.swiftness ?? 0;
    const resilience = data.approaches?.resilience ?? 0;
    const precision = data.approaches?.precision ?? 0;
    const fortune = data.approaches?.fortune ?? 0;

    // Derived attributes
    context.derived = {
      endurance: (power + resilience) * 2,
      composure: (resilience + swiftness) * 2,
      vigilance: Math.ceil((precision + swiftness) / 2),
      focus: power + precision,
      fortunePointsMax: fortune,
      fortunePointsCurrent: Math.floor(fortune / 2) // display-only default
    };

    return context;
  }
}

Hooks.once("init", () => {
  console.log("GFL5R | Initializing");
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("gfl5r", GFL5RActorSheet, { makeDefault: true });
});
