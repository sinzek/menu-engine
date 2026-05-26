/**
 * The Framework-Agnostic Menus API
 *
 * Provides a robust, state-machine driven engine for tooltips, dropdowns, and popovers
 * with advanced spatial awareness and hysteresis.
 */

export type { Menu, MenuEngine } from "./core.ts";
export { menuBuilder } from "./registry.ts";
export { MenuStore } from "./store.ts";
export { MenuFocusManager } from "./focus-manager.ts";
export {
	resolveRegion,
	calculateSafeBridge,
	isPointInRect,
	isPointInPolygon,
} from "./geometry.ts";
export type { MenuType } from "./engine.ts";
