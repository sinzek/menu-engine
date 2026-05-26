# Menu Engine

I was super tired of dealing with clunky, buggy dropdowns and tooltips. Menu Engine is a lightweight, high-performance TypeScript API that acts as a pure state machine for all kinds of menus (like dropdowns, popovers, and tooltips). Under the hood, it handles all the annoying parts like hover delays, roving focus for keyboard navigation, and diagonal mouse bridging so you do not have to write them yourself.

I also set it up to build dual ESM and CommonJS bundles using `tsup`, so it works perfectly in any project.

---

## Cool Features

The engine runs on a deterministic state machine, so all your menu transitions are predictable without any weird or glitchy UI behaviors. It has built-in support for hover delays, close timeouts, custom long press triggers, and even includes Amazon-style safe hover triangle math to keep tooltips open when the mouse moves slightly outside of the hitbox. For keyboard accessibility, there is a roving tabindex focus manager built right in that gives you arrow key navigation and typeahead search out of the box. Plus, it has a zero leak `dispose()` API to safely clean up all timer, parent, and child linkages when you unmount menus. It compiles to a universal build that works in pure JavaScript, React, Vue, Svelte, or whatever frontend stack you prefer.

---

## Quick Start & Examples

Here is how you use the API to power your menus.

### 1. Basic Dropdown Menu

For a typical dropdown menu, you usually want it to open when clicked and close when clicking outside or selecting an item.

```typescript
import { menuBuilder } from "menu-engine";

// Create a dropdown menu
const myDropdown = menuBuilder.dropdown({
	id: "profile-menu",
	trigger: {
		openOn: { click: true },
		closeOn: {
			interactOutside: true,
			escape: true,
			select: true,
		},
	},
});

// Open it programmatically
myDropdown.open();
console.log(myDropdown.getStatus()); // "open"

// Toggle it
myDropdown.toggle(); // closes the menu

// Subscribe to state updates (ideal for triggering UI rerenders)
const unsubscribe = myDropdown.subscribe(() => {
	console.log("Current state changed to:", myDropdown.getStatus());
});
```

### 2. Tooltip with Hover Delay

Tooltips are slightly different. We want them to open on hover (after a short delay) and close when the mouse leaves. We also do not want the tooltip to open if the mouse just swipes past it quickly (hysteresis!).

```typescript
import { menuBuilder } from "menu-engine";

const myTooltip = menuBuilder.tooltip({
	id: "help-tooltip",
	trigger: {
		openOn: {
			hover: { delayMs: 150 },
		},
		closeOn: {
			mouseLeaveHitbox: { delayMs: 200 },
		},
	},
});

// Update the region depending on mouse position (trigger, content, outside)
myTooltip.updateRegion("trigger"); // Status becomes "opening"

// If the mouse leaves before 150ms passes:
myTooltip.updateRegion("outside"); // Instantly cancels and stays "closed"!
```

### 3. Nested Submenus (Nesting)

Nesting is usually a headache, but here it is incredibly simple. When a parent menu closes, all of its open submenus close automatically in a cascade.

```typescript
import { menuBuilder } from "menu-engine";

const parentMenu = menuBuilder.dropdown({ id: "file-menu" });
const subMenu = menuBuilder.dropdown({ id: "export-options" });

// Chain them together
subMenu.setParent(parentMenu);

parentMenu.open();
subMenu.open();

console.log(parentMenu.hasOpenDescendant()); // true

// Closing the parent automatically cascade-closes the submenu!
parentMenu.close();
console.log(subMenu.isOpen()); // false
```

### 4. Roving Keyboard Focus

You can wire up arrow key navigation and typing filters using the built-in focus manager.

```typescript
import { MenuFocusManager } from "menu-engine";

const focusManager = new MenuFocusManager();

// Register elements inside your menu
const unregisterItem1 = focusManager.register({
	id: "item-1",
	el: document.getElementById("btn-1")!,
	disabled: false,
	textValue: "Save Profile",
});

// Navigate around using keyboard actions
focusManager.next(); // Focuses next enabled item
focusManager.typeahead("s"); // Instantly jumps to "Save Profile" using character matching

// Don't forget to unregister when components unmount
unregisterItem1();
```

### 5. Cleaning up (Preventing Memory Leaks)

If you are building dynamic apps where menus are spawned and deleted, call `dispose()` to clean up all event listener sets, active timeout delays, and hierarchy references.

```typescript
// Clean up all references, clear active timeouts, and unbind from parent/children trees
myDropdown.dispose();
```

### 6. React Component Wrapper Example

You can easily wrap this API inside your own React components using `useSyncExternalStore`. Here is a simple example showing how to build a custom, highly responsive Dropdown menu component:

```tsx
import React, { useMemo, useEffect, useRef } from "react";
import { useSyncExternalStore } from "react";
import { menuBuilder, isPointInRect } from "menu-engine";

// 1. Write a custom hook to keep our store stable and sync updates
function useMenuStore(config) {
	const store = useMemo(() => menuBuilder.create(config), []);
	const state = useSyncExternalStore(store.subscribe, store.getState);

	// Clean up references and timers when the component unmounts
	useEffect(() => {
		return () => store.dispose();
	}, [store]);

	return { store, state };
}

// 2. Build the Dropdown component
export function DropdownComponent() {
	const { store, state } = useMenuStore({
		type: "dropdown",
		trigger: {
			openOn: { click: true },
			closeOn: { interactOutside: true, escape: true },
		},
	});

	const triggerRef = useRef<HTMLButtonElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	// Link our DOM elements to the store
	useEffect(() => {
		store.setAnchor({ type: "element", element: triggerRef.current });
		store.setFloatingEl(contentRef.current);
	}, [store]);

	// Feed mouse move events into the region tracker
	const handleMouseMove = (e: React.MouseEvent) => {
		const triggerRect = triggerRef.current?.getBoundingClientRect();
		const contentRect = contentRef.current?.getBoundingClientRect();

		if (triggerRect && isPointInRect(e.clientX, e.clientY, triggerRect)) {
			store.updateRegion("trigger");
		} else if (
			contentRect &&
			isPointInRect(e.clientX, e.clientY, contentRect)
		) {
			store.updateRegion("content");
		} else {
			store.updateRegion("outside");
		}
	};

	return (
		<div
			onMouseMove={handleMouseMove}
			style={{ position: "relative", display: "inline-block" }}
		>
			<button
				ref={triggerRef}
				onClick={() => store.toggle()}
				onFocus={() => store.dispatch("focus_in")}
				onBlur={() => store.dispatch("focus_out")}
				style={{ padding: "8px 16px", cursor: "pointer" }}
			>
				Menu Trigger
			</button>

			{(state.status === "open" || state.status === "closing") && (
				<div
					ref={contentRef}
					style={{
						position: "absolute",
						top: "100%",
						left: 0,
						background: "white",
						border: "1px solid #ddd",
						padding: "8px",
						boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
						zIndex: 10,
					}}
				>
					<button
						style={{ padding: "4px 8px", cursor: "pointer" }}
						onClick={() => store.close()}
					>
						Profile Option
					</button>
					<button
						style={{ padding: "4px 8px", cursor: "pointer" }}
						onClick={() => store.close()}
					>
						Settings Option
					</button>
				</div>
			)}
		</div>
	);
}
```

---

## Project Structure

```text
├── dist/                  # Built files ready for npm publishing
│   ├── index.js          # ESM bundle
│   ├── index.cjs         # CommonJS bundle
│   ├── index.d.ts        # ESM typings
│   └── index.d.cts       # CommonJS typings
├── src/
│   ├── index.ts          # Core package exports
│   ├── core.ts           # Types and configurations definitions
│   ├── engine.ts         # The state reducer and transitions evaluation logic
│   ├── store.ts          # The wrapper store handling timers and state events
│   ├── focus-manager.ts  # roving tabindex keyboard navigator
│   ├── geometry.ts       # Polygon intersection math for Amazon safe hover triangle
│   ├── registry.ts       # Global map cache for managing menus anywhere
│   └── __tests__/        # Complete Vitest suite
│       └── index.test.ts # 26 robust unit tests
├── package.json          # Package manifest
├── tsconfig.json         # TypeScript configuration
└── tsup.config.ts        # Bundler configuration
```

---

## Development Workflow

### 1. Installation

Install project dependencies using `pnpm`:

```bash
pnpm install
```

### 2. Run Tests

Execute the unit test suite:

```bash
pnpm test
```

For continuous testing (watch mode) during development:

```bash
pnpm test:watch
```

### 3. Build for Production

Generate the ESM, CommonJS bundles, and TypeScript declaration files inside `/dist`:

```bash
pnpm run build
```

### 4. Development Build (Watch Mode)

Re-build automatically as you modify source files:

```bash
pnpm run dev
```

---

## License

ISC License. See `package.json` for details.
