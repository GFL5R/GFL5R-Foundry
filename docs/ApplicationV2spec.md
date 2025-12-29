# ApplicationV2 (Foundry VTT v13)

> Up to date as of Foundry VTT v13

Applications are a core piece of Foundry's API. They render HTML windows that provide interactive UI elements such as dialogs, character sheets, and configuration panels.

## Official Documentation

- https://foundryvtt.com/api/v13/classes/foundry.applications.api.ApplicationV2.html
- https://foundryvtt.com/api/v13/classes/foundry.applications.api.DocumentSheetV2.html

### Legend

```js
ApplicationV2.DEFAULT_OPTIONS // `.` indicates static method or property
Application#render            // `#` indicates instance method or property
````

---

## Overview

ApplicationV2 and related classes are located at:

```
resources/app/client/applications
```

---

## Key Concepts

### ApplicationV2 vs Application (V1)

ApplicationV2 was introduced in Foundry V12. The original `Application` class remains supported through V15, with removal planned for V16.

Key improvements:

* Native light and dark mode support
* Improved window frames
* Cleaner lifecycle hooks
* Partial Handlebars re-rendering
* Improved accessibility
* Easier integration with non-Handlebars renderers
* No jQuery dependency by default

jQuery remains available if desired:

```js
const html = $(this.element)
```

A migration guide is available on the Foundry wiki.

---

### Use of ES Modules

ApplicationV2 classes are accessed via nested namespaces.

Recommended destructuring pattern:

```js
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class MyApp extends HandlebarsApplicationMixin(ApplicationV2) {}
```

---

### Which Class to Extend

* Extend `ApplicationV2` for general UI
* Extend `DocumentSheetV2` for document-backed sheets
* A rendering mixin is required (Handlebars or third-party)

---

## API Interactions

### Basic Lifecycle

```js
new MyApp().render(true); // open
this.render();           // re-render
this.close();            // close (instance persists)
```

Application state persists if the instance is retained.

---

### BASE_APPLICATION

Controls how far inheritance propagates for:

* `DEFAULT_OPTIONS`
* Hook execution

Defaults to full inheritance unless overridden.

---

### DEFAULT_OPTIONS

Static configuration merged through the inheritance chain.

```js
static DEFAULT_OPTIONS = {
  position: { width: 600 }
};
```

---

#### Form Handling

To enable native form support:

```js
class MyApplication extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: MyApplication.myFormHandler,
      submitOnChange: false,
      closeOnSubmit: false
    }
  };

  static async myFormHandler(event, form, formData) {
    // handle FormDataExtended
  }
}
```

---

#### Actions

Declarative click handlers using `data-action`.

```js
class MyApplication extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    actions: {
      myAction: MyApplication.myAction
    }
  };

  static myAction(event, target) {
    console.log(this); // application instance
  }
}
```

HTML:

```html
<a data-action="myAction">Click me</a>
```

---

#### Header Buttons

Defined via `window.controls`.

```js
static DEFAULT_OPTIONS = {
  window: {
    controls: [
      {
        icon: "fa-solid fa-triangle-exclamation",
        label: "My Label",
        action: "myAction"
      }
    ]
  }
};
```

---

## HandlebarsApplicationMixin

All default Foundry rendering uses this mixin.

```js
class MyApp extends HandlebarsApplicationMixin(ApplicationV2) {}
```

---

### PARTS

Defines renderable sections.

```js
static PARTS = {
  form: {
    template: "modules/my-module/templates/app.hbs"
  }
};
```

Rules:

* Each part renders one root element
* Parts render in declaration order
* All parts are wrapped in `options.tag`

---

#### Conditional Parts

Override `_configureRenderOptions`.

```js
_configureRenderOptions(options) {
  super._configureRenderOptions(options);
  options.parts = ["header", "tabs"];

  if (!this.document.limited) {
    options.parts.push("details");
  }
}
```

---

### _prepareContext

Async replacement for `getData`.

```js
async _prepareContext() {
  return {
    foo: "bar"
  };
}
```

Only data returned here is available to templates.

---

#### _preparePartContext

Optional per-part context customization.

```js
async _preparePartContext(partId, context) {
  context.partId = partId;
  return context;
}
```

Commonly implemented with a `switch` on `partId`.

---

### Templates Array

Used for preloading Handlebars templates.

```js
templates: [
  "templates/partial-a.hbs",
  "templates/partial-b.hbs"
]
```

Call `super._preFirstRender()` if overridden.

---

## Specific Use Cases

### Adding Event Listeners

Use `_onRender` for non-click events.

```js
_onRender() {
  this.element
    .querySelectorAll(".item-quantity")
    .forEach(input => {
      input.addEventListener("change", e => {
        const itemId = e.target.dataset.itemId;
        this.actor.items.get(itemId).update({
          system: { quantity: e.target.value }
        });
      });
    });
}
```

---

### Tabs

#### V12

Manual state management required using `tabGroups` and `changeTab`.

Each tab element requires:

* `data-group`
* `data-tab`
* CSS tracking of `active`

#### V13

Native tab handling improved. See official AppV2 tab guide.

---

### Text Enrichment

Performed asynchronously during context preparation.

```js
context.enrichedDescription = await TextEditor.enrichHTML(
  this.document.system.description,
  {
    secrets: this.document.isOwner,
    rollData: this.document.getRollData()
  }
);
```

Template rendering:

```hbs
{{{enrichedDescription}}}
```

---

### Drag and Drop

Requires manual setup.

Core steps:

1. Instantiate `DragDrop` in constructor
2. Define `options.dragDrop`
3. Bind handlers in `_onRender`
4. Implement `_onDragStart`, `_onDrop`, etc.

---

### SearchFilter

Manually initialized and bound.

```js
_onSearchFilter(event, query, rgx, html) {
  // filter DOM nodes
}
```

---

### Registering Document Sheets

```js
Hooks.once("init", () => {
  DocumentSheetConfig.registerSheet(
    Actor,
    "package-id",
    MyActorSheet,
    {
      label: "My Sheet",
      types: ["character"],
      makeDefault: true
    }
  );
});
```

---

### Easy Form Submission Buttons

1. Add footer part:

```js
footer: { template: "templates/generic/form-footer.hbs" }
```

2. Provide buttons in context:

```js
buttons: [
  { type: "submit", icon: "fa-solid fa-save", label: "Save" }
]
```

3. Remove `<form>` tags from templates

---

### Non-Handlebars Rendering Frameworks

Community implementations:

* Vue
* Svelte

---

## Troubleshooting

### Button Causes Full Page Refresh

Add `type="button"` if the button should not submit a form.

---

### Arrays in Forms

Foundry supports only primitive arrays by default.

Options:

* Override `_prepareSubmitData`
* Use a `DataModel` with `ArrayField`

---

### Debugging CSS (Light/Dark Toggle)

```js
const uiConfig = game.settings.get("core", "uiConfig");
const newColor =
  uiConfig.colorScheme.applications === "light" ? "dark" : "light";

uiConfig.colorScheme.applications = newColor;
uiConfig.colorScheme.interface = newColor;

await game.settings.set("core", "uiConfig", uiConfig);
```