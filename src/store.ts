import type { Menu, MenuEngine } from "./core.ts";
import {
	compileTriggerRules,
	createTriggerEvaluator,
	transitionState,
} from "./engine.ts";
import type { MenuFocusManager } from "./focus-manager.ts";

type Listener = () => void;

/**
 * A framework-agnostic store that wraps the pure MenuEngine.
 * Handles state mutations, timeouts, and observer subscriptions natively.
 */
export class MenuStore<Pages extends string | never = never> {
	private config: Menu.Config<Pages>;
	private rules: MenuEngine.CompiledTriggerRules;
	private evaluator: MenuEngine.TriggerEvaluator;

	private state: MenuEngine.State = { status: "closed" };
	private page?: Pages;
	private currentRegion: MenuEngine.Region = "outside";
	private anchor: Menu.Anchor = { type: "none" };

	// Hierarchy. A child is closed automatically when its parent closes; the
	// parent treats descendant content as part of its own interactive hitbox.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private parentStore: MenuStore<any> | MenuStore<never> | undefined;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private children = new Set<MenuStore<any> | MenuStore<never>>();
	private floatingEl: HTMLElement | null = null;
	private suppressHoverOpen = false;
	private lastOpenTime = 0;
	private openedThisInteraction = false;
	private lastInteractOutsideTime = 0;

	private stateListeners = new Set<Listener>();
	private pageListeners = new Set<Listener>();
	private anchorListeners = new Set<Listener>();
	private timeoutId?: ReturnType<typeof setTimeout>;
	private safeBridge: MenuEngine.Point[] | null = null;

	/**
	 * Live accessor for `events`. React (or any other adapter) can swap this
	 * out per-render so inline callbacks never capture stale closures.
	 */
	private eventsRef: { current: Menu.Events.Map<Pages> | undefined };

	constructor(config: Menu.Config<Pages>) {
		this.config = config;
		this.rules = compileTriggerRules(config.trigger, config.type);
		this.evaluator = createTriggerEvaluator(this.rules);
		this.eventsRef = { current: config.events };

		if (config.defaultOpen) {
			this.state = { status: "open" };
		}

		if (config.pages && config.pages.length > 0) {
			this.page = config.defaultPage ?? config.pages[0];
		}

		if (config.anchor) {
			this.anchor = config.anchor;
		}
	}

	/** The compiled, defaulted trigger rules. Read-only — useful for UI adapters. */
	public getRules = (): Readonly<MenuEngine.CompiledTriggerRules> => this.rules;

	/** The raw config this store was built with. */
	public getConfig = (): Readonly<Menu.Config<Pages>> => this.config;

	public getAnchor = (): Menu.Anchor => this.anchor;

	public subscribeAnchor = (listener: Listener) => {
		this.anchorListeners.add(listener);
		return () => {
			this.anchorListeners.delete(listener);
		};
	};

	private notifyAnchor() {
		this.anchorListeners.forEach((l) => l());
	}

	/**
	 * Update where the menu positions itself.
	 * Common use: context menus call `openAt(x, y)`; floating UIs call this
	 * when their underlying reference element changes.
	 */
	public setAnchor = (anchor: Menu.Anchor) => {
		this.anchor = anchor;
		this.notifyAnchor();
	};

	/** Convenience: anchor at a screen point and open. Ideal for context menus. */
	public openAt = (x: number, y: number) => {
		this.setAnchor({ type: "point", point: { x, y } });
		this.open();
	};

	public getSafeBridge = (): MenuEngine.Point[] | null => this.safeBridge;
	public setSafeBridge = (bridge: MenuEngine.Point[] | null) => {
		this.safeBridge = bridge;
	};

	// --- HIERARCHY (submenus) ---

	/**
	 * Wire this store under a parent. The parent will:
	 *  - close this store when it closes (cascade)
	 *  - treat this store's floating content as part of its own hitbox
	 *  - suppress its own escape-handling while this store is still open
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public setParent = (
		parent: MenuStore<any> | MenuStore<never> | undefined,
	) => {
		if (this.parentStore === parent) return;
		if (this.parentStore) this.parentStore.removeChild(this);
		this.parentStore = parent;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if (parent) parent.addChild(this as MenuStore<any> | MenuStore<never>);
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public addChild = (child: MenuStore<any> | MenuStore<never>) => {
		this.children.add(child);
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public removeChild = (child: MenuStore<any> | MenuStore<never>) => {
		this.children.delete(child);
	};

	/** Direct children only. Use `walkDescendants` for the whole subtree. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public getChildren = (): ReadonlySet<MenuStore<any> | MenuStore<never>> =>
		this.children;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public getParent = (): MenuStore<any> | MenuStore<never> | undefined =>
		this.parentStore;

	/** Visit every descendant (children, grandchildren, …) depth-first. */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public walkDescendants = (
		visit: (store: MenuStore<any> | MenuStore<never>) => void,
	) => {
		for (const child of this.children) {
			visit(child);
			child.walkDescendants(visit);
		}
	};

	/** Whether any descendant (at any depth) is currently open. */
	public hasOpenDescendant = (): boolean => {
		for (const child of this.children) {
			if (child.isOpen() || child.hasOpenDescendant()) return true;
		}
		return false;
	};

	public setFloatingEl = (el: HTMLElement | null) => {
		this.floatingEl = el;
	};

	public getFloatingEl = (): HTMLElement | null => this.floatingEl;

	public isOpen = (): boolean =>
		this.state.status === "open" ||
		this.state.status === "opening" ||
		this.state.status === "closing";

	// --- FOCUS MANAGER LINKAGE ---
	// The focus manager lives in the UI adapter (React, in our case), but
	// other code (submenus reaching across menus) needs to look it up by store.

	private focusManager: MenuFocusManager | undefined;

	public setFocusManager = (fm: MenuFocusManager | undefined) => {
		this.focusManager = fm;
	};

	public getFocusManager = (): MenuFocusManager | undefined =>
		this.focusManager;

	/**
	 * Swap the live events map. Intended for framework adapters that want to
	 * forward fresh per-render callbacks without rebuilding the store.
	 */
	public setEvents = (events: Menu.Events.Map<Pages> | undefined) => {
		this.eventsRef.current = events;
	};

	private getEvents(): Menu.Events.Map<Pages> | undefined {
		return this.eventsRef.current;
	}

	private getEventContext(): Menu.Context<Pages> {
		const base = {
			open: this.state.status === "open" || this.state.status === "opening",
			setOpen: (val: boolean | ((prev: boolean) => boolean)) => {
				const isOpen =
					typeof val === "function"
						? val(
								this.state.status === "open" || this.state.status === "opening",
							)
						: val;
				if (isOpen) this.open();
				else this.close();
			},
			toggle: this.toggle,
		};

		if (this.page !== undefined) {
			return {
				...base,
				page: this.page,
				setPage: this.setPage,
			} as Menu.Context<Pages>;
		}

		return base as Menu.Context<Pages>;
	}

	public getState = (): MenuEngine.State => this.state;
	public getStatus = (): MenuEngine.State["status"] => this.state.status;
	public getPage = (): Pages | undefined => this.page;
	public getRegion = (): MenuEngine.Region => this.currentRegion;

	/** Subscribe to open/close transitions. Suitable for useSyncExternalStore. */
	public subscribe = (listener: Listener) => {
		this.stateListeners.add(listener);
		return () => {
			this.stateListeners.delete(listener);
		};
	};

	/** Subscribe to page changes only. Lets consumers render-skip when status hasn't moved. */
	public subscribePage = (listener: Listener) => {
		this.pageListeners.add(listener);
		return () => {
			this.pageListeners.delete(listener);
		};
	};

	private notifyState() {
		this.stateListeners.forEach((l) => l());
	}

	private notifyPage() {
		this.pageListeners.forEach((l) => l());
	}

	public setPage = (page: Pages | ((prev: Pages | undefined) => Pages)) => {
		const next =
			typeof page === "function"
				? (page as (p: Pages | undefined) => Pages)(this.page)
				: page;
		if (next === this.page) return;
		this.page = next;
		this.notifyPage();
		this.getEvents()?.onPageChange?.(this.getEventContext());
	};

	/**
	 * The core execution pipeline.
	 */
	private applyDecision(decision: MenuEngine.TransitionDecision) {
		const currentState = this.state;
		const nextState = transitionState(this.state, decision);

		if (currentState === nextState) return;

		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = undefined;
		}

		this.state = nextState;

		const wasOpen =
			currentState.status === "open" || currentState.status === "opening";
		const isOpen =
			this.state.status === "open" || this.state.status === "opening";

		if (decision.shouldClose && decision.reason === "outside") {
			this.lastInteractOutsideTime = Date.now();
		}

		if (!wasOpen && isOpen) {
			this.lastOpenTime = Date.now();
			this.openedThisInteraction = true;
		}

		if (wasOpen !== isOpen) {
			this.getEvents()?.onOpenChange?.(this.getEventContext());
			// Cascade-close descendants when this menu closes.
			if (!isOpen) {
				for (const child of this.children) child.close();
			}
		}

		this.checkForHoverSuppression(wasOpen, isOpen);
		this.notifyState();

		if (decision.delayMs && decision.delayMs > 0) {
			const targetType = decision.shouldOpen ? "open" : "close";
			this.timeoutId = setTimeout(() => {
				this.completeTransition(targetType);
			}, decision.delayMs);
		}
	}

	private completeTransition(type: "open" | "close") {
		const currentState = this.state;
		let stateChanged = false;

		if (type === "open" && this.state.status === "opening") {
			this.state = { status: "open" };
			stateChanged = true;
		} else if (type === "close" && this.state.status === "closing") {
			this.state = { status: "closed" };
			stateChanged = true;
		}

		if (stateChanged) {
			const wasOpen =
				currentState.status === "open" || currentState.status === "opening";
			const isOpen =
				this.state.status === "open" || this.state.status === "opening";

			if (!wasOpen && isOpen) {
				this.lastOpenTime = Date.now();
				this.openedThisInteraction = true;
			}

			if (wasOpen !== isOpen) {
				this.getEvents()?.onOpenChange?.(this.getEventContext());
				if (!isOpen) {
					for (const child of this.children) child.close();
				}
			}

			this.checkForHoverSuppression(wasOpen, isOpen);
			this.notifyState();
		}
	}

	private checkForHoverSuppression(wasOpen: boolean, isOpen: boolean) {
		if (wasOpen && !isOpen) {
			if (this.currentRegion === "trigger") {
				this.suppressHoverOpen = true;
			}
		}
	}

	/** Send an interaction signal into the decision engine. */
	public dispatch = (signal: MenuEngine.InteractionSignal) => {
		if (
			signal === "pointer_move" &&
			this.suppressHoverOpen &&
			this.currentRegion === "trigger"
		) {
			return;
		}
		const decision = this.evaluator.evaluate(signal, {
			currentRegion: this.currentRegion,
			state: this.state,
		});
		if (decision.shouldOpen || decision.shouldClose) {
			console.log(
				`[MenuStore] dispatch("${signal}") region=${this.currentRegion} status=${this.state.status} → open=${decision.shouldOpen} close=${decision.shouldClose} reason=${decision.reason}`,
			);
		}
		this.applyDecision(decision);
	};

	/** Notify the engine that the pointer has moved across region boundaries. */
	public updateRegion = (region: MenuEngine.Region) => {
		if (this.currentRegion === region) return;
		this.currentRegion = region;

		if (region === "outside" || region === "content") {
			this.suppressHoverOpen = false;
		}

		if (region === "outside") this.dispatch("pointer_leave");
		else this.dispatch("pointer_move");
	};

	/**
	 * Fire when an item inside the menu is selected.
	 * Invokes `onSelect`, and closes the menu if `closeOn.select` is configured.
	 * If `closeOn.select` is `{ cssSelector }`, only matching targets cause close.
	 */
	public select = (event: Menu.Events.PointerInteraction) => {
		this.getEvents()?.onSelect?.({ ...this.getEventContext(), event });
		if (event.defaultPrevented) return;
		if (this.parentStore) {
			this.parentStore.select(event);
		}
		if (!this.rules.closeOnSelect) return;
		if (this.rules.closeOnSelectSelector) {
			const target = event.currentTarget;
			const el = target instanceof Element ? target : null;
			if (!el || !el.matches(this.rules.closeOnSelectSelector)) return;
		}
		this.close();
	};

	// --- LIFECYCLE EVENT FORWARDERS ---
	// The UI layer calls these to keep all event plumbing in one place. The
	// store invokes the matching callback from the live `events` map, so inline
	// callbacks always see fresh closures.

	public fireKeyDown = (event: Menu.Events.KeyboardInteraction) => {
		this.getEvents()?.onKeyDown?.({ ...this.getEventContext(), event });
	};

	public fireInteractOutside = (event: Menu.Events.PointerInteraction) => {
		this.getEvents()?.onInteractOutside?.({ ...this.getEventContext(), event });
	};

	public fireMouseEnter = (event: Menu.Events.PointerInteraction) => {
		this.getEvents()?.onMouseEnter?.({ ...this.getEventContext(), event });
	};

	public fireMouseLeave = (event: Menu.Events.PointerInteraction) => {
		this.getEvents()?.onMouseLeave?.({ ...this.getEventContext(), event });
	};

	public fireFocusChange = (event: Menu.Events.FocusInteraction) => {
		this.getEvents()?.onFocusChange?.({ ...this.getEventContext(), event });
	};

	// --- IMPERATIVE API ---

	public open = (opts?: { bypassInteractOutsideGuard?: boolean }) => {
		if (
			!opts?.bypassInteractOutsideGuard &&
			Date.now() - this.lastInteractOutsideTime < 100
		)
			return;
		this.applyDecision({
			shouldOpen: true,
			shouldClose: false,
			reason: "programmatic",
			cancelPrevious: true,
		});
	};

	public close = () => {
		this.applyDecision({
			shouldOpen: false,
			shouldClose: true,
			reason: "programmatic",
			cancelPrevious: true,
		});
	};

	public handlePointerUp = () => {
		setTimeout(() => {
			this.openedThisInteraction = false;
		}, 0);
	};

	public toggle = () => {
		if (this.state.status === "open") {
			if (this.rules.closeOnClick) {
				if (this.openedThisInteraction) return;
				this.close();
			}
		} else {
			if (this.rules.openOnClick) {
				this.open();
			}
		}
	};

	/**
	 * Disposes of the store.
	 * Cleans up active timers, disassociates parent/child relations to prevent memory leaks,
	 * and clears all event listeners.
	 */
	public dispose = () => {
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = undefined;
		}

		// Disassociate from parent to prevent parent -> child memory leaks
		this.setParent(undefined);

		// Disassociate from all children
		for (const child of this.children) {
			child.setParent(undefined);
		}
		this.children.clear();

		// Clear all listeners to prevent memory leaks from long-lived observer closures
		this.stateListeners.clear();
		this.pageListeners.clear();
		this.anchorListeners.clear();
		
		if (this.floatingEl) {
			this.floatingEl = null;
		}
		if (this.focusManager) {
			this.focusManager.clear();
			this.focusManager = undefined;
		}
	};
}
