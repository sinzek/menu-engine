import { MenuStore } from "./store.ts";
import type { Menu } from "./core.ts";

/**
 * A global registry for all menus.
 * Allows imperative definition and control of menus outside of React components.
 */
class MenuRegistry {
	private stores = new Map<string, MenuStore<string>>();

	public create<Pages extends string | never = never>(
		config: Menu.Config<Pages>,
	): MenuStore<Pages> {
		const id = config.id;
		if (id) {
			const existing = this.stores.get(id);
			if (existing) return existing as unknown as MenuStore<Pages>;
			const store = new MenuStore(config);
			this.stores.set(id, store as unknown as MenuStore<string>);
			return store;
		}
		return new MenuStore(config);
	}

	/** Create a new popover. */
	public popover<Pages extends string | never = never>(
		config: Menu.PopoverConfig<Pages>,
	) {
		return this.create<Pages>(config);
	}

	/** Create a new tooltip. */
	public tooltip<Pages extends string | never = never>(
		config: Menu.TooltipConfig<Pages>,
	) {
		return this.create<Pages>(config);
	}

	/** Create a new dropdown menu. */
	public dropdown<Pages extends string | never = never>(
		config: Menu.DropdownConfig<Pages>,
	) {
		return this.create<Pages>(config);
	}

	/** Retrieve a menu store by id. */
	public get<Pages extends string | never = string>(
		id: string,
	): MenuStore<Pages> | undefined {
		return this.stores.get(id) as MenuStore<Pages> | undefined;
	}

	/** Remove a menu from the registry. */
	public remove(id: string) {
		this.stores.delete(id);
	}
}

/**
 * The global menu registry. This serves as the primary entry point for managing
 * and controlling all framework-agnostic menus in your application.
 *
 * You can use this registry to imperatively create and retrieve menu stores by ID,
 * allowing you to command them globally from anywhere (inside or outside framework render trees).
 *
 * @example
 * // 1. Create a menu store
 * const fileMenu = menus.dropdown({
 *   id: "file-menu",
 *   trigger: {
 *     openOn: { click: true },
 *     closeOn: { interactOutside: true }
 *   }
 * });
 *
 * // 2. Retrieve the menu store later in another module
 * const store = menus.get("file-menu");
 * store?.open();
 *
 * // 3. Clean up the menu from the registry when finished
 * menus.remove("file-menu");
 */
export const menus = new MenuRegistry();
