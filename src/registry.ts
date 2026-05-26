import { MenuStore } from "./store.ts";
import type { Menu } from "./core.ts";

/**
 * A global registry for all menus.
 * Allows imperative definition and control of menus outside of React components.
 */
class MenuRegistry {
	private stores = new Map<string, MenuStore<string>>();

	/** Get-or-create by id. If no id is supplied, returns a fresh, unregistered store. */
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

	public popover<Pages extends string | never = never>(
		config: Menu.PopoverConfig<Pages>,
	) {
		return this.create<Pages>(config);
	}

	public tooltip<Pages extends string | never = never>(
		config: Menu.TooltipConfig<Pages>,
	) {
		return this.create<Pages>(config);
	}

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

export const menuBuilder = new MenuRegistry();
