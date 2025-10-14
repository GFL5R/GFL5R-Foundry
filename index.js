class BarebonesActorSheet extends ActorSheet {
  get template() {
    return "systems/gfl5r/templates/actor-sheet.html";
  }

  getData() {
    const context = super.getData();
    const data = context.actor.system;

    // Derived attributes
    const power = data.approaches.power || 0;
    const swiftness = data.approaches.swiftness || 0;
    const resilience = data.approaches.resilience || 0;
    const precision = data.approaches.precision || 0;
    const fortune = data.approaches.fortune || 0;

    context.derived = {
      endurance: (power + resilience) * 2,
      composure: (resilience + swiftness) * 2,
      vigilance: Math.ceil((precision + swiftness) / 2),
      focus: power + precision,
      fortunePointsMax: fortune,
      fortunePointsCurrent: Math.floor(fortune / 2)
    };

    return context;
  }
}

Hooks.once("init", () => {
  console.log("GFL5R | Initializing");
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("gfl5r", BarebonesActorSheet, { makeDefault: true });
});
