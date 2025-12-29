// Shared dice constants/helpers
export const systemId = () => game?.system?.id ?? CONFIG?.system?.id ?? "gfl5r";

export const PATHS = {
  get templates() {
    return `systems/${systemId()}/templates/`;
  },
  get assets() {
    return `systems/${systemId()}/assets/`;
  },
};

console.log("GFL5R | dice-constants.js loaded");
