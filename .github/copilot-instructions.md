# GFL5R Foundry VTT System - AI Coding Guidelines

## Project Overview
GFL5R is a Foundry VTT system module that adapts Legend of the Five Rings (L5R) mechanics to a near-future military sci-fi setting. The system features a custom dice pool mechanic using black d6s and white d12s with success/opportunity/strife outcomes.

## Core Architecture

### Entry Point & Initialization
- **Main Entry**: `module/main.js` - Registers all system components during Foundry's `init` hook
- **ES Modules**: All code uses modern ES module imports/exports
- **No Build System**: Code runs directly as ES modules in Foundry's environment

### Key Components
- **`module/dice.js`**: Complex dice roller with drag-and-drop interface (`GFLRollerApp`)
- **`module/actors.js`**: Character sheet logic with approaches, skills, and disciplines
- **`module/items.js`**: Multiple item sheet types (abilities, weapons, armor, disciplines, modules)
- **`module/combat.js`**: Custom combat system with approach-based initiative
- **`module/config.js`**: Game constants and XP progression (`GFL5R_CONFIG`)
- **`module/hooks.js`**: GM combat tracker UI enhancements
- **`module/settings.js`**: Foundry settings registration

## Data Model Patterns

### Character Structure
```javascript
// From template.json - characters have:
{
  approaches: { power, swiftness, resilience, precision, fortune }, // Core attributes
  skills: { blades: 0, firearms: 0, /* ... 18 total skills */ }, // Skill ranks
  disciplines: { slot1: { disciplineId, xp, rank, abilities } }, // Up to 5 discipline slots
  resources: { fatigue, strife, fortunePoints }, // Status tracking
  characterType: "human" | "transhumanist" | "doll" // Affects available features
}
```

### Derived Stats
- **Endurance**: `(power + resilience) * 2`
- **Composure**: `(resilience + swiftness) * 2`
- **Vigilance**: `Math.ceil((precision + swiftness) / 2)`
- **Focus**: `power + precision`

### Dice System
- **Black Dice (d6)**: Success/Opportunity/Strife combinations
- **White Dice (d12)**: Higher probability of successes and opportunities
- **Mechanics**: Keep dice up to approach limit, reroll opportunities, explode successes
- **Outcomes**: Each die contributes success (s), opportunity (o), strife (r), explosive (x)

## Development Patterns

### Sheet Registration
```javascript
// Always register sheets in items.js or actors.js
Items.registerSheet("gfl5r", GFL5RWeaponSheet, {
  types: ["weaponry"],
  makeDefault: true
});
```

### Handlebars Integration
- Custom helpers registered in `main.js`: `object`, `capitalize`
- Templates in `/templates/` directory
- Use `systems/${game.system.id}/templates/...` paths

### CSS Architecture
- **CSS Variables**: Extensive use of `--gfl-*` variables in `styles.css`
- **Frosted Glass Theme**: Multi-layer backgrounds with cyan accents
- **Component Classes**: `.gfl5r` namespace for all system styles

### Combat & Initiative
- **Encounter Types**: intrigue/duel/skirmish/mass_battle → different initiative skills
- **Prepared State**: Affects whether focus or vigilance is used for initiative
- **Custom Combat Class**: `GFL5RCombat` extends Foundry's base Combat

## Common Tasks

### Adding New Item Types
1. Create sheet class in `items.js` extending `ItemSheet`
2. Add to `registerItemSheets()` function
3. Create corresponding template in `/templates/item-[type].html`
4. Add type to `system.json` documentTypes

### Modifying Dice Logic
- Update `payloadBlack()`/`payloadWhite()` functions for die faces
- Modify `expandRoll()` for result processing
- Update roller UI in `templates/roller.html`

### Character Sheet Changes
- Modify `getData()` in `GFL5RActorSheet` for new derived stats
- Update `templates/actor-sheet.html` with new fields
- Add data to `template.json` if new system fields needed

## File Organization
- **`/module/`**: All JavaScript logic
- **`/templates/`**: Handlebars HTML templates
- **`/assets/dice/`**: Die face images (black/white folders)
- **`system.json`**: Foundry system manifest
- **`template.json`**: Data schema definitions
- **`styles.css`**: Unified theming system

## Testing & Validation
- **Manual Testing**: Load system in Foundry, create characters, test dice rolls
- **Console Logging**: Use `console.log("GFL5R | ...")` for debugging
- **Data Validation**: Check `actor.system` and `item.system` structures match `template.json`

## Key Integration Points
- **Dice Roller**: `GFLRollerApp` handles complex multi-step rolls with chat updates
- **GM Tools**: Combat tracker bar in `hooks.js` for encounter management
- **Settings**: World-scoped settings for initiative and difficulty
- **Chat Integration**: Dice results update chat messages in real-time</content>
<parameter name="filePath">/home/jgarland/Downloads/GFL5R/GFL5R-Foundry/.github/copilot-instructions.md