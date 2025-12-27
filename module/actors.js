// module/actors.js
console.log("GFL5R | actors.js loaded");

import { GFL5R_CONFIG } from "./config.js";
import { computeDerivedStats } from "./utils/derived.js";

export class GFL5RActorSheet extends ActorSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["sheet", "actor"],
      width: 860,
      height: 700,
      tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "skills" }]
    });
  }

  get template() {
    return `systems/${game.system.id}/templates/actor-sheet.html`;
  }

  async getData(options) {
    console.log("GFL5R | getData()");
    const context = await super.getData(options);
    const data = context.actor.system ?? {};

    context.derived = computeDerivedStats(data.approaches, data.resources);
    context.availableXP = Number(data.xp ?? 0);

    // Approaches for card rendering
    const approachesData = data.approaches ?? {};
    context.approachesList = [
      { key: "power", label: "Power", value: Number(approachesData.power ?? 0) },
      { key: "swiftness", label: "Swiftness", value: Number(approachesData.swiftness ?? 0) },
      { key: "resilience", label: "Resilience", value: Number(approachesData.resilience ?? 0) },
      { key: "precision", label: "Precision", value: Number(approachesData.precision ?? 0) },
      { key: "fortune", label: "Fortune", value: Number(approachesData.fortune ?? 0) }
    ];

    const preparedDefaultSetting = game.settings.get("gfl5r", "initiative-prepared-character") || "true";
    const preparedFlag = data.prepared;
    context.preparedState = typeof preparedFlag === "boolean"
      ? preparedFlag
      : (preparedFlag === "true" ? true : (preparedFlag === "false" ? false : preparedDefaultSetting === "true"));

    // Character type for modules visibility
    context.characterType = data.characterType ?? "human";
    context.showModules = (context.characterType === "doll" || context.characterType === "transhumanist");

    // Expose skills and labels for rendering
    context.skills = data.skills ?? {};
    context.skillGroups = [
      {
        title: "Combat Skills",
        items: [
          { key: "blades", label: "Blades" },
          { key: "firearms", label: "Firearms" },
          { key: "handToHand", label: "Hand-To-Hand" },
          { key: "explosives", label: "Explosives" },
          { key: "tactics", label: "Tactics" },
          { key: "exoticWeapons", label: "Exotic Weapons" }
        ]
      },
      {
        title: "Fieldcraft Skills",
        items: [
          { key: "athletics", label: "Athletics" },
          { key: "stealth", label: "Stealth" },
          { key: "survival", label: "Survival" },
          { key: "centering", label: "Centering" },
          { key: "insight", label: "Insight" },
          { key: "observation", label: "Observation" }
        ]
      },
      {
        title: "Technical Skills",
        items: [
          { key: "mechanics", label: "Mechanics" },
          { key: "computers", label: "Computers" },
          { key: "medicine", label: "Medicine" },
          { key: "piloting", label: "Piloting" },
          { key: "subterfuge", label: "Subterfuge" },
          { key: "science", label: "Science" }
        ]
      },
      {
        title: "Social & Cultural Skills",
        items: [
          { key: "command", label: "Command" },
          { key: "negotiation", label: "Negotiation" },
          { key: "deception", label: "Deception" },
          { key: "performance", label: "Performance" },
          { key: "culture", label: "Culture" },
          { key: "arts", label: "Arts" }
        ]
      }
    ];

    // Process disciplines
    const disciplinesData = data.disciplines ?? {};
    context.disciplineSlots = [];
    
    for (let i = 1; i <= GFL5R_CONFIG.maxDisciplineSlots; i++) {
      const slotKey = `slot${i}`;
      const slotData = disciplinesData[slotKey] ?? {
        disciplineId: null,
        xp: 0,
        rank: 1,
        abilities: []
      };
      
      let disciplineItem = null;
      if (slotData.disciplineId) {
        disciplineItem = this.actor.items.get(slotData.disciplineId);
      }
      
      // Get abilities for this discipline
      const disciplineAbilities = (slotData.abilities ?? [])
        .map(abilityId => this.actor.items.get(abilityId))
        .filter(a => a); // Remove null entries
      
      // Calculate XP remaining for next rank
      const xpForNextRank = GFL5R_CONFIG.getXPForNextRank(slotData.rank ?? 1);
      const xpRemaining = xpForNextRank ? (xpForNextRank - (slotData.xp ?? 0)) : null;
      
      context.disciplineSlots.push({
        slotKey,
        slotNumber: i,
        discipline: disciplineItem ? {
          id: disciplineItem.id,
          name: disciplineItem.name,
          img: disciplineItem.img,
          system: disciplineItem.system ?? {}
        } : null,
        xp: slotData.xp ?? 0,
        rank: slotData.rank ?? 1,
        xpForNext: xpForNextRank,
        xpRemaining: xpRemaining > 0 ? xpRemaining : null,
        abilities: disciplineAbilities.map(a => ({
          id: a.id,
          name: a.name,
          img: a.img,
          system: a.system ?? {}
        }))
      });
    }

    // Filter items by type
    // Get all discipline ability IDs to exclude from general abilities
    const disciplineAbilityIds = new Set();
    context.disciplineSlots.forEach(slot => {
      if (slot.abilities) {
        slot.abilities.forEach(ability => disciplineAbilityIds.add(ability.id));
      }
    });
    
    // Only show abilities that are NOT assigned to any discipline
    context.abilities = this.actor.items
      .filter(i => i.type === "ability" && !disciplineAbilityIds.has(i.id))
      .map(i => ({
        id: i.id,
        name: i.name,
        img: i.img,
        system: i.system ?? {}
      }));

    // Narrative items - split by type
    const narrativeItems = this.actor.items.filter(i => i.type === "narrative");
    context.narrativePositive = narrativeItems
      .filter(i => i.system.narrativeType === "distinction" || i.system.narrativeType === "passion")
      .map(i => ({
        id: i.id,
        name: i.name,
        img: i.img,
        system: i.system ?? {}
      }));
    context.narrativeNegative = narrativeItems
      .filter(i => i.system.narrativeType === "adversity" || i.system.narrativeType === "anxiety")
      .map(i => ({
        id: i.id,
        name: i.name,
        img: i.img,
        system: i.system ?? {}
      }));

    // Combat tab - weapons and armor
    context.weapons = this.actor.items.filter(i => i.type === "weaponry").map(i => ({
      id: i.id,
      name: i.name,
      img: i.img,
      system: i.system ?? {}
    }));
    context.armor = this.actor.items.filter(i => i.type === "armor").map(i => ({
      id: i.id,
      name: i.name,
      img: i.img,
      system: i.system ?? {}
    }));

    // Modules tab
    context.modules = this.actor.items.filter(i => i.type === "module").map(i => ({
      id: i.id,
      name: i.name,
      img: i.img,
      system: i.system ?? {}
    }));

    // Inventory - exclude disciplines, their abilities, and narrative items
    const disciplineIds = new Set(
      context.disciplineSlots
        .filter(slot => slot.discipline)
        .map(slot => slot.discipline.id)
    );
    
    context.inventory = this.actor.items
      .filter(i => 
        i.type !== "discipline" && 
        i.type !== "narrative" &&
        i.type !== "module" &&
        !disciplineIds.has(i.id) && 
        !disciplineAbilityIds.has(i.id)
      )
      .map(i => ({
        id: i.id,
        name: i.name,
        type: i.type,
        img: i.img,
        system: i.system ?? {}
      }));

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    console.log("GFL5R | activateListeners()");

    // Delete item (works for abilities and any other items)
    html.on("click", "[data-action='delete-item']", ev => {
      const id = ev.currentTarget?.dataset?.itemId;
      if (!id) return;
      return this.actor.deleteEmbeddedDocuments("Item", [id]);
    });

    // Edit item
    html.on("click", "[data-action='edit-item']", ev => {
      const id = ev.currentTarget?.dataset?.itemId;
      if (!id) return;
      const item = this.actor.items.get(id);
      if (item) item.sheet.render(true);
    });

    const flashSkillCard = (element, danger = false) => {
      if (!element) return;
      element.classList.add(danger ? "xp-flash-danger" : "xp-flash");
      setTimeout(() => element.classList.remove("xp-flash", "xp-flash-danger"), 450);
    };

    const rollSkill = async (key, skillLabel) => {
      const approaches = this.actor.system?.approaches ?? {};

      const content = await renderTemplate(`systems/${game.system.id}/templates/roll-prompt.html`, {
        approaches,
        defaultTN: 2
      });

      new Dialog({
        title: `Roll ${skillLabel}`,
        content,
        buttons: {
          roll: {
            label: "Roll",
            callback: async (dlg) => {
              const form = dlg[0].querySelector("form");
              const approachName = form.elements["approach"].value;
              const tnHidden = form.elements["hiddenTN"].checked;
              const tnVal = Number(form.elements["tn"].value || 0);
              const approachVal = Number(approaches[approachName] ?? 0);

              const { GFLRollerApp } = await import("./dice.js");
              const app = new GFLRollerApp({
                actor: this.actor,
                skillKey: key,
                skillLabel,
                approach: approachVal,
                approachName,
                tn: tnHidden ? null : tnVal,
                hiddenTN: tnHidden
              });
              await app.start();
            }
          },
          cancel: { label: "Cancel" }
        },
        default: "roll"
      }, {
        classes: ["sheet"]
      }).render(true);
    };

    // Increase skill rank using XP
    html.on("click", "[data-action='skill-increase']", async ev => {
      const key = ev.currentTarget?.dataset?.skill;
      if (!key) return;

      const skillCard = ev.currentTarget.closest?.("[data-skill-card]");
      const skills = foundry.utils.duplicate(this.actor.system.skills ?? {});
      const currentRank = Number(skills[key] ?? 0);
      const nextRank = currentRank + 1;
      const cost = 2 * nextRank;
      const availableXP = Number(this.actor.system?.xp ?? 0);

      if (availableXP < cost) {
        flashSkillCard(skillCard, true);
        ui.notifications?.warn("Not enough XP to increase this skill.");
        return;
      }

      skills[key] = nextRank;
      await this.actor.update({
        [`system.skills.${key}`]: nextRank,
        "system.xp": availableXP - cost
      });
      flashSkillCard(skillCard);
    });

    // Decrease skill rank and refund XP
    html.on("click", "[data-action='skill-decrease']", async ev => {
      const key = ev.currentTarget?.dataset?.skill;
      if (!key) return;

      const skillCard = ev.currentTarget.closest?.("[data-skill-card]");
      const skills = foundry.utils.duplicate(this.actor.system.skills ?? {});
      const currentRank = Number(skills[key] ?? 0);
      if (currentRank <= 0) return;

      const refund = 2 * currentRank;
      const availableXP = Number(this.actor.system?.xp ?? 0);
      const newRank = currentRank - 1;

      skills[key] = newRank;
      await this.actor.update({
        [`system.skills.${key}`]: newRank,
        "system.xp": availableXP + refund
      });
      flashSkillCard(skillCard);
    });

    // Increase approach rank using XP (cost 3x next rank)
    html.on("click", "[data-action='approach-increase']", async ev => {
      const key = ev.currentTarget?.dataset?.approach;
      if (!key) return;

      const card = ev.currentTarget.closest?.("[data-approach-card]");
      const approaches = foundry.utils.duplicate(this.actor.system.approaches ?? {});
      const currentRank = Number(approaches[key] ?? 0);
      const nextRank = currentRank + 1;
      const cost = 3 * nextRank;
      const availableXP = Number(this.actor.system?.xp ?? 0);

      if (availableXP < cost) {
        flashSkillCard(card, true);
        ui.notifications?.warn("Not enough XP to increase this approach.");
        return;
      }

      approaches[key] = nextRank;
      await this.actor.update({
        [`system.approaches.${key}`]: nextRank,
        "system.xp": availableXP - cost
      });
      flashSkillCard(card);
    });

    // Decrease approach rank and refund XP (refund 3x current rank)
    html.on("click", "[data-action='approach-decrease']", async ev => {
      const key = ev.currentTarget?.dataset?.approach;
      if (!key) return;

      const card = ev.currentTarget.closest?.("[data-approach-card]");
      const approaches = foundry.utils.duplicate(this.actor.system.approaches ?? {});
      const currentRank = Number(approaches[key] ?? 0);
      if (currentRank <= 0) return;

      const refund = 3 * currentRank;
      const availableXP = Number(this.actor.system?.xp ?? 0);
      const newRank = currentRank - 1;

      approaches[key] = newRank;
      await this.actor.update({
        [`system.approaches.${key}`]: newRank,
        "system.xp": availableXP + refund
      });
      flashSkillCard(card);
    });

    // Remove discipline from slot
    html.on("click", "[data-action='remove-discipline']", async ev => {
      const slotKey = ev.currentTarget?.dataset?.slotKey;
      if (!slotKey) return;
      
      const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
      if (disciplines[slotKey]) {
        const toDelete = [];
        const disciplineId = disciplines[slotKey].disciplineId;
        
        // Check if discipline exists before adding to delete list
        if (disciplineId && this.actor.items.get(disciplineId)) {
          toDelete.push(disciplineId);
        }
        
        // Check if abilities exist before adding to delete list
        if (disciplines[slotKey].abilities?.length) {
          for (const abilityId of disciplines[slotKey].abilities) {
            if (this.actor.items.get(abilityId)) {
              toDelete.push(abilityId);
            }
          }
        }
        
        // Delete all items that exist
        if (toDelete.length > 0) {
          await this.actor.deleteEmbeddedDocuments("Item", toDelete);
        }
        
        // Reset slot
        disciplines[slotKey] = {
          disciplineId: null,
          xp: 0,
          rank: 1,
          abilities: []
        };
        
        await this.actor.update({ "system.disciplines": disciplines });
      }
    });

    // Update discipline XP
    html.on("change", "[data-action='discipline-xp']", async ev => {
      const slotKey = ev.currentTarget?.dataset?.slotKey;
      const xp = Number(ev.currentTarget.value) || 0;
      if (!slotKey) return;
      
      const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
      if (disciplines[slotKey]) {
        disciplines[slotKey].xp = xp;
        disciplines[slotKey].rank = GFL5R_CONFIG.getRankFromXP(xp);
        await this.actor.update({ "system.disciplines": disciplines });
      }
    });

    // Update discipline rank
    html.on("change", "[data-action='discipline-rank']", async ev => {
      const slotKey = ev.currentTarget?.dataset?.slotKey;
      const rank = Number(ev.currentTarget.value) || 1;
      if (!slotKey) return;
      
      const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
      if (disciplines[slotKey]) {
        disciplines[slotKey].rank = rank;
        await this.actor.update({ "system.disciplines": disciplines });
      }
    });

    // Remove ability from discipline
    html.on("click", "[data-action='remove-discipline-ability']", async ev => {
      const slotKey = ev.currentTarget?.dataset?.slotKey;
      const abilityId = ev.currentTarget?.dataset?.abilityId;
      if (!slotKey || !abilityId) return;
      
      const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
      if (disciplines[slotKey]?.abilities) {
        // Remove from abilities list
        disciplines[slotKey].abilities = disciplines[slotKey].abilities.filter(id => id !== abilityId);
        await this.actor.update({ "system.disciplines": disciplines });
        
        // Delete the ability if it exists
        if (this.actor.items.get(abilityId)) {
          await this.actor.deleteEmbeddedDocuments("Item", [abilityId]);
        }
      }
    });

    // Click skill NAME (label) to roll
    html.on("click", "[data-action='roll-skill']", async ev => {
      const labelEl = ev.currentTarget;
      const key = labelEl.dataset.skill;            // e.g. "blades"
      const skillLabel = labelEl.textContent.trim();
      await rollSkill(key, skillLabel);
    });

    // Click anywhere on the skill card to roll (unless clicking buttons)
    html.on("click", "[data-skill-card]", async ev => {
      if (ev.target.closest("button")) return;
      const card = ev.currentTarget;
      const key = card.dataset.skillKey;
      const label = card.querySelector("[data-action='roll-skill']")?.textContent?.trim() || key;
      if (!key) return;
      await rollSkill(key, label);
    });

  }

  /** Accept dropped Items (from compendia or sidebar) into the drop zones */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);
    const flashDropTarget = (el) => {
      if (!el) return;
      el.classList.add("border", "border-success", "bg-success-subtle");
      setTimeout(() => el.classList.remove("border-success", "bg-success-subtle"), 400);
    };

    // Check which drop zone was targeted
    const dropAbilities = event.target?.closest?.("[data-drop-target='abilities']");
    const dropNarrativePos = event.target?.closest?.("[data-drop-target='narrative-positive']");
    const dropNarrativeNeg = event.target?.closest?.("[data-drop-target='narrative-negative']");
    const dropInventory = event.target?.closest?.("[data-drop-target='inventory']");
    const dropModules = event.target?.closest?.("[data-drop-target='modules']");
    
    // Check for discipline slot drops
    const dropDiscipline = event.target?.closest?.("[data-drop-target='discipline']");
    const dropDisciplineAbility = event.target?.closest?.("[data-drop-target='discipline-ability']");
    
    const dropTarget = dropAbilities || dropNarrativePos || dropNarrativeNeg || dropInventory || dropModules || dropDiscipline || dropDisciplineAbility;
    if (!dropTarget) return super._onDrop(event);

    // Resolve a Document from the drop
    let itemDoc;
    try {
      if (data?.uuid) {
        const doc = await fromUuid(data.uuid);
        if (doc?.documentName === "Item") itemDoc = doc;
      }
      if (!itemDoc) {
        // Foundry v12 compat: Item.implementation.fromDropData if present
        const fromDrop = Item.implementation?.fromDropData ?? Item.fromDropData;
        itemDoc = await fromDrop(data);
      }
    } catch (err) {
      ui.notifications?.error("Unable to import dropped item.");
      console.error(err);
      return;
    }
    if (!itemDoc) return;

    // Handle discipline slot drops
    if (dropDiscipline) {
      const slotKey = dropTarget.dataset.slotKey;
      if (!slotKey) return;
      
      // Clone the item data
      let itemData = itemDoc.toObject();
      itemData.type = "discipline";
      
      // Update disciplines data
      const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
      if (!disciplines[slotKey]) {
        disciplines[slotKey] = { disciplineId: null, xp: 0, rank: 1, abilities: [] };
      }
      
      // Remove old discipline if exists
      if (disciplines[slotKey].disciplineId) {
        const oldDiscipline = this.actor.items.get(disciplines[slotKey].disciplineId);
        const toDelete = [];
        
        // Add discipline to delete list if it exists
        if (oldDiscipline) {
          toDelete.push(disciplines[slotKey].disciplineId);
        }
        
        // Add abilities to delete list if they exist
        if (disciplines[slotKey].abilities?.length) {
          for (const abilityId of disciplines[slotKey].abilities) {
            if (this.actor.items.get(abilityId)) {
              toDelete.push(abilityId);
            }
          }
        }
        
        // Delete all items that exist
        if (toDelete.length > 0) {
          await this.actor.deleteEmbeddedDocuments("Item", toDelete);
        }
      }
      
      // Create the discipline item
      const [createdItem] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
      
      disciplines[slotKey].disciplineId = createdItem.id;
      disciplines[slotKey].abilities = []; // Reset abilities list
      await this.actor.update({ "system.disciplines": disciplines });
      
      flashDropTarget(dropTarget);
      return;
    }

    // Handle discipline ability drops
    if (dropDisciplineAbility) {
      const slotKey = dropTarget.dataset.slotKey;
      if (!slotKey) return;

      const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
      if (!disciplines[slotKey]) return;

      const availableXP = Number(this.actor.system?.xp ?? 0);
      const cost = 3;
      if (availableXP < cost) {
        dropTarget.classList.add("border", "border-danger", "bg-danger-subtle");
        setTimeout(() => dropTarget.classList.remove("border-danger", "bg-danger-subtle"), 500);
        ui.notifications?.warn("Not enough XP to add an ability to this discipline (costs 3 XP).");
        return;
      }

      // Clone the item data
      let itemData = itemDoc.toObject();
      itemData.type = "ability";

      // Create the ability item
      const [createdItem] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
      if (!createdItem) return;

      // Update disciplines data and actor XP
      disciplines[slotKey].abilities ||= [];
      disciplines[slotKey].abilities.push(createdItem.id);

      const updatedXP = Number(disciplines[slotKey].xp ?? 0) + cost;
      disciplines[slotKey].xp = updatedXP;
      disciplines[slotKey].rank = GFL5R_CONFIG.getRankFromXP(updatedXP);

      await this.actor.update({
        "system.xp": availableXP - cost,
        "system.disciplines": disciplines
      });

      flashDropTarget(dropTarget);
      return;
    }

    // Clone the item data
    let itemData = itemDoc.toObject();
    if (!itemData.system) itemData.system = {};

    // Handle different drop zones
    if (dropAbilities) {
      // Force type to ability
      itemData.type = "ability";
      itemData.system.description ??= itemDoc.system?.description ?? "";
    } else if (dropNarrativePos || dropNarrativeNeg) {
      // Force type to narrative
      itemData.type = "narrative";
      itemData.system.description ??= itemDoc.system?.description ?? "";
      // Set narrative type based on drop zone
      if (dropNarrativePos && !itemData.system.narrativeType) {
        itemData.system.narrativeType = "distinction";
      } else if (dropNarrativeNeg && !itemData.system.narrativeType) {
        itemData.system.narrativeType = "adversity";
      }
    } else if (dropModules) {
      // Force type to module
      itemData.type = "module";
      itemData.system.description ??= itemDoc.system?.description ?? "";
    } else if (dropInventory) {
      // Keep original type for inventory (accepts all types)
      itemData.system.description ??= itemDoc.system?.description ?? "";
    }

    // Create on actor
    await this.actor.createEmbeddedDocuments("Item", [itemData]);

    // Subtle UI feedback
    flashDropTarget(dropTarget);
  }
}

export class GFL5RNPCSheet extends ActorSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["sheet", "actor", "npc"],
      width: 700,
      height: 600,
      tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "features" }]
    });
  }

  get template() {
    return `systems/${game.system.id}/templates/npc-sheet.html`;
  }

  async getData(options) {
    console.log("GFL5R | NPC getData()");
    const context = await super.getData(options);
    const data = context.actor.system ?? {};

    context.derived = computeDerivedStats(data.approaches, data.resources);

    // Expose simplified skills
    context.skills = data.skills ?? {};

    // Features - all items (abilities, weapons, armor, narrative items, etc.)
    context.features = this.actor.items.map(i => ({
      id: i.id,
      name: i.name,
      type: i.type,
      img: i.img,
      system: i.system ?? {}
    }));

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    console.log("GFL5R | NPC activateListeners()");

    // Delete item
    html.on("click", "[data-action='delete-item']", ev => {
      const id = ev.currentTarget?.dataset?.itemId;
      if (!id) return;
      return this.actor.deleteEmbeddedDocuments("Item", [id]);
    });

    // Edit item
    html.on("click", "[data-action='edit-item']", ev => {
      const id = ev.currentTarget?.dataset?.itemId;
      if (!id) return;
      const item = this.actor.items.get(id);
      if (item) item.sheet.render(true);
    });
  }

  async _onDropItem(event, data) {
    if (!this.actor.isOwner) return false;

    // Get the item
    let itemData = await Item.fromDropData(data);
    if (!itemData) return false;

    // Create on actor
    await this.actor.createEmbeddedDocuments("Item", [itemData]);

    // Subtle UI feedback
    event.currentTarget.classList.add("border", "border-success", "bg-success-subtle");
    setTimeout(() => event.currentTarget.classList.remove("border-success", "bg-success-subtle"), 400);
  }
}

export function registerActorSheets() {
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("gfl5r", GFL5RActorSheet, {
    makeDefault: true,
    types: ["character"]
  });
  Actors.registerSheet("gfl5r", GFL5RNPCSheet, {
    types: ["npc"]
  });
}
