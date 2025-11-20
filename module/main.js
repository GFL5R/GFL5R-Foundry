import { registerActorSheets } from "./actors.js";
import { registerItemSheets } from "./items.js";
import { registerDiceTerms } from "./dice.js";

Hooks.once("init", () => {
  console.log("GFL5R | Initializing");

  Handlebars.registerHelper("object", function () {
    const out = {};
    for (let i = 0; i < arguments.length - 1; i += 2) out[arguments[i]] = arguments[i + 1];
    return out;
  });

  Handlebars.registerHelper("capitalize", (s) => {
    s = (s ?? "").toString();
    return s.charAt(0).toUpperCase() + s.slice(1);
  });

  registerActorSheets();
  registerItemSheets();
  registerDiceTerms();
});

// Intercept combat tracker rendering to add combat type selector
Hooks.on("renderCombatTracker", (app, html, data) => {
  const combat = game.combat;
  if (!combat) return;
  
  // Ensure html is a jQuery object
  const $html = html instanceof jQuery ? html : $(html);
  
  // Get current combat type from combat flags
  const currentType = combat.getFlag("gfl5r", "combatType") || "skirmish";
  
  // Add combat type selector to header
  const header = $html.find("header.directory-header");
  if (header.length && !header.find(".gfl5r-combat-type").length) {
    const combatTypeSelector = `
      <div class="gfl5r-combat-type" style="padding: 4px 8px; background: rgba(0,0,0,0.2); border-bottom: 1px solid #000; display: flex; align-items: center; justify-content: space-between;">
        <label style="margin: 0; font-weight: bold;">Initiative Type:</label>
        <select name="combatType" style="flex: 1; margin-left: 8px;">
          <option value="intrigue" ${currentType === "intrigue" ? "selected" : ""}>Intrigue (Insight)</option>
          <option value="duel" ${currentType === "duel" ? "selected" : ""}>Duel (Centering)</option>
          <option value="skirmish" ${currentType === "skirmish" ? "selected" : ""}>Skirmish (Tactics)</option>
          <option value="massBattle" ${currentType === "massBattle" ? "selected" : ""}>Mass Battle (Command)</option>
        </select>
      </div>
    `;
    header.after(combatTypeSelector);
    
    // Add change handler
    $html.find(".gfl5r-combat-type select").on("change", async (event) => {
      const newType = event.target.value;
      await combat.setFlag("gfl5r", "combatType", newType);
      ui.notifications?.info(`Combat type changed to ${event.target.options[event.target.selectedIndex].text}`);
    });
  }
  
  // Override initiative roll buttons
  $html.find(".combatant").each((i, li) => {
    const combatantId = li.dataset.combatantId;
    const combatant = combat?.combatants?.get(combatantId);
    if (!combatant?.actor) return;
    
    // Find the initiative roll button
    const rollBtn = li.querySelector('a[data-control="rollInitiative"]');
    if (rollBtn) {
      // Replace the click handler
      rollBtn.onclick = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        // Get combat type from combat flags
        const combatType = combat.getFlag("gfl5r", "combatType") || "skirmish";
        await combatant.actor.rollInitiative({ combatType });
      };
    }
  });
});

// Set default combat type on new combat
Hooks.on("createCombat", async (combat, options, userId) => {
  if (game.user.isGM && !combat.getFlag("gfl5r", "combatType")) {
    await combat.setFlag("gfl5r", "combatType", "skirmish");
  }
});
