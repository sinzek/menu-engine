/* eslint-disable @typescript-eslint/no-namespace */
// in the future, i plan to add dialogs, sheets, etc.

type BaseMenuConfig<Pages extends string | never> = {
	/** A unique identifier for the menu. If provided, the menu will be controllable globally with `menus(<id>).foo().`
	 *  If omitted, the system will generate its own internal ID.
	 */
	id?: string;
	/**
	 * `DEFAULT = false`
	 *
	 * Whether the menu should be open when first created.
	 *
	 * This only affects uncontrolled menus - controlled menus should derive their open state externally.
	 */
	defaultOpen?: boolean;
	/**
	 * `DEFAULT = pages[0]` or `undefined` if `pages` is empty.
	 *
	 * Optional default page to open when the menu is created or opened.
	 */
	defaultPage?: Pages;
	/**
	 * `DEFAULT = true` for dropdowns and tooltips, `false` for popovers.
	 *
	 * Whether the menu behaves modally.
	 * Modal menus trap focus and prevent interaction outside the menu.
	 * Non-modal menus allow background interaction while open.
	 */
	modal?: boolean;
	/**
	 * Controls how the menu is triggered. Omit if the menu is strictly controlled via external state or is only opened imperatively (e.g. `menus('id').open()`).
	 */
	trigger?: Menu.Trigger;
	/**
	 * An optional map of callback functions that will be invoked at various points in the menu’s lifecycle.
	 * All callbacks receive a `MenuContext` containing the current open state, page state, and setter functions.
	 * Additional properties on the callback arguments are event-specific (e.g., `KeyboardEvent`, `PointerEvent`).
	 */
	events?: Menu.Events.Map<Pages>;
	/**
	 * `DEFAULT = { type: 'none' }`
	 *
	 * The anchor for the menu. This determines where the menu will be positioned relative to.
	 * `type: 'none'` means the menu will not be positioned.
	 * `type: 'element'` means the menu will be positioned relative to the provided element.
	 * `type: 'point'` means the menu will be positioned relative to the provided point.
	 * `type: 'virtual'` means the menu will be positioned relative to the provided virtual element.
	 * `type: 'menu'` means the menu will be positioned relative to the provided menu.
	 */
	anchor?: Menu.Anchor;
	/**
	 * How the menu sits relative to its anchor. Includes `placement`, `offset`
	 * (gap in px), `flip`, `shift`, `shiftPadding`, and `sameWidth`.
	 *
	 * Anything passed here is the default; `<Root placement=…>` props override
	 * on a per-instance basis.
	 */
	position?: Menu.Position;
	pages?: Pages[];
};

export namespace Menu {
	export type PopoverConfig<Pages extends string | never = never> =
		BaseMenuConfig<Pages> & {
			type: "popover";
		};

	export type TooltipConfig<Pages extends string | never = never> =
		BaseMenuConfig<Pages> & {
			type: "tooltip";
		};

	export type DropdownConfig<Pages extends string | never = never> =
		BaseMenuConfig<Pages> & {
			type: "dropdown";
		};

	export type Config<Pages extends string | never = never> =
		| PopoverConfig<Pages>
		| TooltipConfig<Pages>
		| DropdownConfig<Pages>;

	export namespace Events {
		export type Map<Pages extends string | never> = {
			/** Triggers when the open state of the menu changes. */
			onOpenChange?: (ctx: Menu.Context<Pages>) => void;
			/** Triggers when the page of the menu changes. */
			onPageChange?: (ctx: Menu.Context<Pages>) => void;
			/** Triggers when an item is selected in the menu. */
			onSelect?: (
				ctx: Menu.Context<Pages> & { event: Menu.Events.PointerInteraction },
			) => void;
			/** Triggers when a key is pressed while the menu is open. */
			onKeyDown?: (
				ctx: Menu.Context<Pages> & { event: Menu.Events.KeyboardInteraction },
			) => void;
			/** Triggers when an interaction with the menu outside of the menu itself occurs. */
			onInteractOutside?: (
				ctx: Menu.Context<Pages> & { event: Menu.Events.PointerInteraction },
			) => void;
			/** Triggers when the pointer enters the menu. */
			onMouseEnter?: (
				ctx: Menu.Context<Pages> & { event: Menu.Events.PointerInteraction },
			) => void;
			/** Triggers when the pointer leaves the menu. */
			onMouseLeave?: (
				ctx: Menu.Context<Pages> & { event: Menu.Events.PointerInteraction },
			) => void;
			/** Triggers when the focus of the menu changes. */
			onFocusChange?: (
				ctx: Menu.Context<Pages> & { event: Menu.Events.FocusInteraction },
			) => void;
		};

		type Interaction = {
			/** Timestamp of the interaction. */
			timestamp: number;
			/** Whether the default behavior of the interaction has been prevented. */
			defaultPrevented: boolean;
			/** Whether propagation of the interaction has been stopped. */
			propagationStopped: boolean;
			/** Prevent the default behavior of the interaction. */
			preventDefault(): void;
			/** Stop propagation of the interaction. */
			stopPropagation(): void;
			/** The element that triggered the interaction. */
			target: unknown;
			/** The element that the interaction was dispatched to. */
			currentTarget: unknown;
		};

		type IOInteraction = Interaction & {
			/** Whether the alt key was pressed. */
			altKey: boolean;
			/** Whether the control key was pressed. */
			ctrlKey: boolean;
			/** Whether the meta key was pressed. */
			metaKey: boolean;
			/** Whether the shift key was pressed. */
			shiftKey: boolean;
		};

		export type PointerInteraction = IOInteraction & {
			/** The type of pointer interaction. */
			type:
				| "pointer_down"
				| "pointer_up"
				| "pointer_move"
				| "pointer_enter"
				| "pointer_leave"
				| "click"
				| "double_click"
				| "context_menu";

			/** The x-coordinate of the pointer interaction. */
			x: number;
			/** The y-coordinate of the pointer interaction. */
			y: number;
			/** The button that triggered the pointer interaction. */
			button: number;
		};

		export type KeyboardInteraction = IOInteraction & {
			/** The type of keyboard interaction. */
			type: "keydown" | "keyup";
			/** The key that triggered the keyboard interaction. */
			key: string;
			/** The code of the key that triggered the keyboard interaction. */
			code: string;
			/** Whether the key was pressed repeatedly. */
			repeat: boolean;
		};

		export type FocusInteraction = Interaction & {
			/** The type of focus interaction. */
			type: "focus" | "blur";
			/** The element that the focus interaction was dispatched to. */
			relatedTarget: unknown;
		};
	}

	export type Anchor =
		| { type: "element"; element: HTMLElement | null | undefined }
		| { type: "point"; point: { x: number; y: number } }
		| {
				type: "virtual";
				getRect: () => { x: number; y: number; width: number; height: number };
		  }
		| { type: "none" };

	export type Placement =
		`${"top" | "bottom" | "left" | "right"}-${"start" | "end" | "center"}`;

	export type Position = {
		/** Where the floating surface sits relative to its anchor. Defaults to `bottom-start`. */
		placement?: Placement;
		/** Gap in pixels between anchor and floating surface. Defaults to 6. */
		offset?: number;
		/** Allow flipping to the opposite side when there's no room. Defaults to `true`. */
		flip?: boolean;
		/** Allow shifting along the main axis to stay in the viewport. Defaults to `true`. */
		shift?: boolean;
		/** Padding from viewport edges used by `shift`. Defaults to 8px. */
		shiftPadding?: number;
		/** Force the floating surface to match the anchor's width. Defaults to `false`. */
		sameWidth?: boolean;
	};

	type OpenStateConfig = {
		/** Open when clicked. */
		click?: boolean | undefined;
		/** Open when context menu is triggered. */
		contextMenu?: boolean | undefined;
		/** Open when long press is triggered (click + hold or touch + hold). */
		longPress?: boolean | { minDurationMs: number } | undefined;
		/** Open when hover is triggered. */
		hover?: boolean | { delayMs: number } | undefined;
		/** Open when focus is applied to the trigger. */
		focus?: boolean | { delayMs: number } | undefined;
	};

	type CloseStateConfig = {
		/**
		 * `DEFAULT = false` (except tooltips which default to true)
		 * Close when the trigger is clicked.
		 */
		click?: boolean | undefined;
		/**
		 * `DEFAULT = true`
		 * Close when escape is pressed.
		 */
		escape?: boolean | undefined;
		/**
		 * `DEFAULT = true`
		 * Close when an interaction outside the menu container occurs.
		 */
		interactOutside?: boolean | { delayMs: number } | undefined;
		/**
		 * `DEFAULT = false`
		 * Close when an interactive element within the menu is clicked/pressed or when an element found by the provided selector is clicked/pressed.
		 */
		select?: boolean | { cssSelector: string } | undefined;
		/**
		 * `DEFAULT = true`
		 * Close when focus leaves the menu container.
		 */
		blur?: boolean | undefined;
		/**
		 * `DEFAULT = true` for tooltips, false otherwise.
		 * Close when pointer leaves the entire hitbox of the menu (trigger + content + padding).
		 */
		mouseLeaveHitbox?: boolean | { delayMs: number } | undefined;
		/**
		 * `DEFAULT = true` for tooltips, false otherwise.
		 * Close when pointer enters the container of the menu (content + padding).
		 */
		enterContainer?: boolean | { delayMs: number } | undefined;
	};

	export type Trigger = {
		/**
		 * Optional configuration for when the menu should open.
		 *
		 * If not provided, default behavior will be used based on the menu type.
		 */
		openOn?: OpenStateConfig | undefined;
		/**
		 * Optional configuration for when the menu should close.
		 *
		 * If not provided, default behavior will be used based on the menu type.
		 */
		closeOn?: CloseStateConfig | undefined;
		/**
		 * Optional behavior configuration for the menu trigger.
		 *
		 * If not provided, default behavior will be used based on the menu type.
		 */
		behavior?: {
			/**
			 * `DEFAULT = true` for dropdowns and popovers, false for tooltips.
			 *
			 * If true, hover leave events are ignored while pointer is moving between trigger and content.
			 */
			ignoreBetweenRegions?: boolean;

			/**
			 * `DEFAULT = 100`
			 *
			 * Prevent rapid open/close flickering.
			 */
			hysteresisMs?: number;
		};
	};

	type BaseContext = {
		open: boolean;
		setOpen: Setter<boolean>;
		toggle: () => void;
	};

	export type PageSetter<Pages extends string | never> = (
		page: Pages | ((prev: Pages | undefined) => Pages),
	) => void;

	export type Context<Pages extends string | never> = [Pages] extends [never]
		? BaseContext
		: BaseContext & {
				page: Pages;
				setPage: PageSetter<Pages>;
			};
}

/**
 * Internal engine state for the framework-agnostic menu system.
 * Not exposed in the public API directly; drives the deterministic transition engine.
 */
export namespace MenuEngine {
	// --- 1. GEOMETRY & REGIONS ---

	/**
	 * Represents the base spatial zones a menu interacts with.
	 */
	export type Region = "outside" | "trigger" | "content" | "safe";

	/**
	 * A composite region used for semantic grouping (e.g., resolving mouseLeaveHitbox).
	 */
	export type SurfaceRegion = "interactive" | "outside";

	/**
	 * Tracks pointer movement between regions to drive transition logic.
	 */
	export type PointerRegionState = {
		from: Region;
		to: Region;
		x: number;
		y: number;
		timestamp: number;
	};

	export type Point = { x: number; y: number };

	/**
	 * The geometry foundation for region resolution.
	 */
	export type RegionRects = {
		trigger: DOMRect;
		content: DOMRect | null;
		/**
		 * A polygon (array of points) representing the Amazon-style safe bridge
		 * between the cursor's exit point and the content corners.
		 */
		safe?: Point[] | null;
	};

	// --- 2. SIGNALS & SESSIONS ---

	/**
	 * Normalized interaction signals.
	 * Decouples raw DOM events from the engine's internal decision logic.
	 */
	export type InteractionSignal =
		| "pointer_down"
		| "pointer_up"
		| "pointer_move"
		| "pointer_leave"
		| "focus_in"
		| "focus_out"
		| "key_escape"
		| "interact_outside";

	/**
	 * Continuous pointer state machine for tracking hover sessions and preventing flicker.
	 */
	export type InteractionSession = {
		id: string;
		startRegion: Region;
		currentRegion: Region;
		lastMoveTime: number;
	};

	/**
	 * Tracks movement across regions for hover logic.
	 */
	export type RegionTransition = {
		from: Region;
		to: Region;
		session: InteractionSession;
	};

	// --- 3. STATE MACHINE & TRANSITIONS ---

	/**
	 * The bridge between behavior config and runtime transitions.
	 */
	export type Transition =
		| {
				type: "open";
				reason: "click" | "hover" | "focus" | "contextMenu" | "longPress";
		  }
		| {
				type: "close";
				reason:
					| "escape"
					| "outside"
					| "blur"
					| "select"
					| "mouseLeave"
					| "programmatic";
		  };

	/**
	 * Allows cancelling an in-flight transition (e.g., user hovers out before hover delay completes).
	 */
	export type TransitionToken = {
		id: string;
		type: Transition["type"];
		startedAt: number;
		cancelled: boolean;
	};

	/**
	 * Internal engine state machine.
	 */
	export type State =
		| { status: "closed" }
		| { status: "opening"; transition: Transition; token: TransitionToken }
		| { status: "open" }
		| { status: "closing"; transition: Transition; token: TransitionToken };

	// --- 4. DECISION ENGINE & COMPILED RULES ---

	/**
	 * Normalized config after resolving defaults and combining behaviors.
	 * Prevents runtime complexity explosion.
	 */
	export type CompiledTriggerRules = {
		// Timing
		openDelayMs: number;
		closeDelayMs: number;
		hysteresisMs: number;
		longPressDelayMs: number;

		// Regions
		ignoreBetweenRegions: boolean;

		// Open Triggers
		openOnClick: boolean;
		openOnHover: boolean;
		openOnFocus: boolean;
		openOnContextMenu: boolean;
		openOnLongPress: boolean;

		// Close Triggers
		closeOnClick: boolean;
		closeOnEscape: boolean;
		closeOnInteractOutside: boolean;
		closeOnBlur: boolean;
		closeOnSelect: boolean;
		/** If set, only matching descendants of the content fire close-on-select. */
		closeOnSelectSelector: string | null;
		closeOnMouseLeaveHitbox: boolean;
		closeOnEnterContainer: boolean;
	};

	/**
	 * Represents the evaluated outcome of an interaction signal.
	 */
	export type TransitionDecision = {
		shouldOpen: boolean;
		shouldClose: boolean;
		reason?: Transition["reason"];
		delayMs?: number;
		cancelPrevious?: boolean;
	};

	/**
	 * The core decision engine that enforces hysteresis, delays, and region logic.
	 */
	export type TriggerEvaluator = {
		evaluate(
			signal: InteractionSignal,
			context: { currentRegion: Region; state: State },
		): TransitionDecision;
	};
}

type Setter<T> = (value: T | ((prev: T) => T)) => void;
