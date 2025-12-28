import { GFL5R_CONFIG } from "./config.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

class BaseGFLItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static buildOptions({ width, height }) {
    return {
      classes: ["sheet", "item"],
      position: { width, height }
    };
  }
}

export class GFL5RAbilitySheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 500 }),
    window: { title: "Ability" }
  };

  static PARTS = {
    sheet: { template: "systems/gfl5r/templates/item-ability.html" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.skillGroups = GFL5R_CONFIG.skillGroups;
    return context;
  }
}

export class GFL5RWeaponSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 600 }),
    window: { title: "Weapon" }
  };

  static PARTS = {
    sheet: { template: "systems/gfl5r/templates/item-weapon.html" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.skillGroups = GFL5R_CONFIG.skillGroups;
    return context;
  }
}

export class GFL5RArmorSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 500 }),
    window: { title: "Armor" }
  };

  static PARTS = {
    sheet: { template: "systems/gfl5r/templates/item-armor.html" }
  };
}

export class GFL5RNarrativeSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 500 }),
    window: { title: "Narrative" }
  };

  static PARTS = {
    sheet: { template: "systems/gfl5r/templates/item-narrative.html" }
  };
}

export class GFL5RItemSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 450 }),
    window: { title: "Item" }
  };

  static PARTS = {
    sheet: { template: "systems/gfl5r/templates/item-item.html" }
  };
}

export class GFL5RDisciplineSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 600 }),
    window: { title: "Discipline" }
  };

  static PARTS = {
    sheet: { template: "systems/gfl5r/templates/item-discipline.html" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.skillGroups = GFL5R_CONFIG.skillGroups;
    const skills = context.item?.system?.associatedSkills;
    context.associatedSkills = Array.isArray(skills) ? skills : [];
    return context;
  }
}

export class GFL5RModuleSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 550 }),
    window: { title: "Module" }
  };

  static PARTS = {
    sheet: { template: "systems/gfl5r/templates/item-module.html" }
  };
}

export class GFL5RConditionSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 500 }),
    window: { title: "Condition" }
  };

  static PARTS = {
    sheet: { template: "systems/gfl5r/templates/item-condition.html" }
  };
}

export function registerItemSheets() {
  const Items = foundry.documents.collections.Items;
  Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  Items.registerSheet("gfl5r", GFL5RAbilitySheet, { types: ["ability"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RWeaponSheet, { types: ["weaponry"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RArmorSheet, { types: ["armor"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RNarrativeSheet, { types: ["narrative"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RItemSheet, { types: ["item"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RDisciplineSheet, { types: ["discipline"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RModuleSheet, { types: ["module"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RConditionSheet, { types: ["condition"], makeDefault: true });
}
