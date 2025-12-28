# Copilot Instructions for GFL5R-Foundry

## System Architecture
- **Foundry VTT game system** (id "gfl5r") for a near-future L5R variant
- **No build tooling**: ES modules loaded directly from [system.json](system.json)—edit JS/HTML/CSS in place and reload the world in Foundry
- **No package.json or bundlers**: This is a pure ES module system using Foundry's native loading

## Core Entry Points & Initialization
- **Entry point**: [module/main.js](module/main.js) runs on `init` hook, orchestrates all registration:
  - Handlebars helpers → world settings → custom combat class → actor/item sheets → dice terms
  - New global setup (hooks, classes, configs) belongs here
- **Configuration**: [module/config.js](module/config.js) holds:
  - Discipline XP tables: `[16, 20, 24]` for ranks 1-4, max 5 discipline slots
  - Initiative skill mapping by encounter type: `intrigue→insight`, `duel→resolve`, `skirmish→tactics`, `mass_battle→command`
  - Helper methods: `getXPForNextRank(currentRank)` and `getRankFromXP(xp)` — reuse these, don't duplicate XP math
- **Settings**: [module/settings.js](module/settings.js) defines world-scoped initiative settings (encounter type, difficulty, hidden flag, prepared flag)
  - Changing `initiative-encounter` forces combat tracker rerender via `onChange` callback
  - Follow this pattern for new system settings

## Data Schema & Conventions
- **Actor types**: `character` (PCs/T-Dolls with full stats) and `npc` (simplified stat blocks)
- **Actor system fields**: `approaches` (power/swiftness/resilience/precision/fortune), `resources` (fatigue/strife/fortunePoints/collapse), `skills` (24 skills grouped in 4 categories), `disciplines` (slot1-slot5 objects: `{disciplineId, xp, rank, abilities[]}`)
- **Item types** (9 total): `ability`, `weaponry`, `armor`, `narrative`, `item`, `generic`, `discipline`, `module`, `condition`
- **Character types**: `human` (nationality + background) or T-Doll (frame-based)—see [module/actors.js](module/actors.js) for `HUMAN_NATIONALITIES`, `HUMAN_BACKGROUNDS`, `TDOLL_FRAMES` constants
- Preserve these schema keys when updating data models or handling item drops

## Dice System (L5R-inspired)
- **Black dice (d6)**: Ring/approach dice—faces 1-6 map to blank/opp+strife/opp/success+strife/success/explosive+strife
- **White dice (d12)**: Skill dice—faces 1-12 with more success/opportunity variants and less strife
- **Roller flow**: [module/dice.js](module/dice.js) `GFLRollerApp` provides interactive keep/reroll/explode workflow
  - Keep-limit equals chosen approach value (explosion dice don't count toward limit)
  - Chat message updates after every action (keep, reroll, explode)
  - Handles hidden-TN fortune bonuses and initiative integration
- Roll formula: approach dice (d6) + skill dice (d12), e.g., `3d6 + 2d12`

## Sheets & UI Components
- **Actor sheets**: [module/actors.js](module/actors.js)
  - Character sheets compute derived stats via [module/utils/derived.js](module/utils/derived.js): `computeDerivedStats(approaches, resources)` returns endurance, composure, vigilance, focus, fortunePointsMax
  - Manage up to 5 discipline slots, orchestrate drag-and-drop for items (abilities, disciplines, modules, narrative, inventory)
  - NPC sheets simpler: treat all items as features
  - Extend `ActorSheet` classes, don't modify Foundry core
- **Item sheets**: [module/items.js](module/items.js) registers separate sheets for each item type
  - Add new item types here + matching templates under [templates/](templates/)
- **Handlebars helpers**: Centralized in [module/utils/handlebars.js](module/utils/handlebars.js) (object builder, eq/ifCond, discipline slot helpers)

## Combat & Initiative
- **Custom combat class**: [module/combat.js](module/combat.js) `GFL5RCombat` overrides `rollInitiative`
  - Prompts per-combatant rolls via roller app with prepared vs. unprepared logic:
    - **Prepared**: base initiative = power + precision
    - **Unprepared**: base initiative = ⌈(precision + swiftness)/2⌉
  - Encounter type (intrigue/duel/skirmish/mass_battle) determines skill used for roll
  - Sorting: higher initiative, then alphabetical by name
- **GM tracker bar**: [module/hooks.js](module/hooks.js) injects UI on `renderCombatTracker` for GMs only
  - Renders [templates/gm/combat-tracker-bar.html](templates/gm/combat-tracker-bar.html)
  - Dropdowns persist to world settings using jQuery `.on("change")` handlers

## Workflow & Development Practices
- **No automated tests**: Manual testing by reloading Foundry world
- **Debugging**: Console logging enabled throughout (`console.log("GFL5R | ...")`)
- **UI patterns**: Use `html.on()` jQuery-style handlers, Foundry `Dialog` API, and `renderTemplate()` for dynamic content
- **Adding features checklist**:
  1. Register settings/helpers up front in [module/settings.js](module/settings.js) or [module/utils/handlebars.js](module/utils/handlebars.js)
  2. Add UI elements in templates, wire with jQuery handlers
  3. Keep chat updates/notifications consistent with existing roller/combat patterns
  4. Update derived stat logic in [module/utils/derived.js](module/utils/derived.js) if needed
- **Version bump rule**: Always increment patch version in [system.json](system.json) line 5 when making any change

## Compatibility & Assets
- **Foundry compatibility**: Minimum v12, verified v13—some code has v12 shims (Hooks, `Item.implementation`), don't remove unless dropping v12
- **Templates**: Located in [templates/](templates/) for actor/item sheets, roller, roll prompt, GM UI
- **Assets**: Dice face icons in [assets/dice/black/](assets/dice/black/) and [assets/dice/white/](assets/dice/white/), paths built dynamically as `systems/gfl5r/assets/dice/{black|white}/{face-key}.png`
