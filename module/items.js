import { GFL5R_CONFIG } from "./config.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

const systemId = () => game?.system?.id ?? CONFIG?.system?.id ?? "gfl5r";
const templatePath = (relativePath) => `systems/${systemId()}/${relativePath}`;

class BaseGFLItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static buildOptions({ width, height }) {
    return {
      classes: ["sheet", "item"],
      position: { width, height },
      window: { resizable: true }
    };
  }

  get title() {
    const item = this.document ?? this.object ?? this.item;
    const type = item?.type ?? "Item";
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    const name = item?.name ?? typeLabel;
    return `${typeLabel}: ${name}`;
  }
}

export class GFL5RAbilitySheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 500 }),
    window: { title: "Ability", resizable: true }
  };

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/item-ability.html"), scrollable: [""] }
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.skillGroups = GFL5R_CONFIG.skillGroups;
    return context;
  }
}

export class GFL5RWeaponSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 600 }),
    window: { title: "Weapon", resizable: true }
  };

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/item-weapon.html"), scrollable: [""] }
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.skillGroups = GFL5R_CONFIG.skillGroups;
    return context;
  }
}

export class GFL5RArmorSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 500 }),
    window: { title: "Armor", resizable: true }
  };

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/item-armor.html"), scrollable: [""] }
    };
  }
}

export class GFL5RNarrativeSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 500 }),
    window: { title: "Narrative", resizable: true }
  };

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/item-narrative.html"), scrollable: [""] }
    };
  }
}

export class GFL5RItemSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 450 }),
    window: { title: "Item", resizable: true }
  };

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/item-sheet.html"), scrollable: [""] }
    };
  }
}

export class GFL5RDisciplineSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 600 }),
    window: { title: "Discipline", resizable: true }
  };

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/item-discipline.html"), scrollable: [""] }
    };
  }

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
    window: { title: "Module", resizable: true }
  };

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/item-module.html"), scrollable: [""] }
    };
  }
}

export class GFL5RConditionSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 500 }),
    window: { title: "Condition", resizable: true }
  };

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/item-condition.html"), scrollable: [""] }
    };
  }
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
