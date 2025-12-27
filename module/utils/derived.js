// Shared derived calculations for actors and NPCs
export function computeDerivedStats(approaches = {}, resources = {}) {
  const power = Number(approaches.power ?? 0);
  const swiftness = Number(approaches.swiftness ?? 0);
  const resilience = Number(approaches.resilience ?? 0);
  const precision = Number(approaches.precision ?? 0);
  const fortune = Number(approaches.fortune ?? 0);

  const endurance = (power + resilience) * 2;
  const composure = (resilience + swiftness) * 2;
  const vigilance = Math.ceil((precision + swiftness) / 2);
  const focus = power + precision;

  const fortunePointsMax = fortune;
  const fortunePointsCurrent = Number(resources.fortunePoints ?? Math.floor(fortunePointsMax / 2));

  return {
    endurance,
    composure,
    vigilance,
    focus,
    fortunePointsMax,
    fortunePointsCurrent
  };
}
