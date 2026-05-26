import type { Menu, MenuEngine } from "./core.ts";

export type MenuType = Menu.Config["type"];

/**
 * 1. The Trigger Compiler
 *
 * Normalizes user configuration into deterministic rules for the engine.
 * This resolves optional delays into concrete numbers, establishes defaults based on menu type,
 * and sets up exact behaviors (e.g., click vs hover).
 */
export function compileTriggerRules(
	trigger: Menu.Trigger | undefined,
	menuType: MenuType,
): MenuEngine.CompiledTriggerRules {
	const openOn = trigger?.openOn;
	const closeOn = trigger?.closeOn;

	return {
		openDelayMs: typeof openOn?.hover === "object" ? openOn.hover.delayMs : 0,
		closeDelayMs:
			Math.max(
				typeof closeOn?.interactOutside === "object"
					? closeOn.interactOutside.delayMs
					: 0,
				typeof closeOn?.mouseLeaveHitbox === "object"
					? closeOn.mouseLeaveHitbox.delayMs
					: 0,
				typeof closeOn?.enterContainer === "object"
					? closeOn.enterContainer.delayMs
					: 0,
			) || 0,
		hysteresisMs: trigger?.behavior?.hysteresisMs ?? 100,
		longPressDelayMs:
			typeof openOn?.longPress === "object"
				? openOn.longPress.minDurationMs
				: 500,

		ignoreBetweenRegions:
			trigger?.behavior?.ignoreBetweenRegions ?? menuType !== "tooltip",

		openOnClick: openOn?.click ?? menuType !== "tooltip",
		openOnHover:
			openOn?.hover !== undefined ? !!openOn.hover : menuType === "tooltip",
		openOnFocus: openOn?.focus !== undefined ? !!openOn.focus : true,
		openOnContextMenu: openOn?.contextMenu ?? false,
		openOnLongPress: !!openOn?.longPress,

		// Close Triggers
		closeOnClick: closeOn?.click ?? true,
		closeOnEscape: closeOn?.escape ?? true,
		closeOnInteractOutside: !!(closeOn?.interactOutside ?? true),
		closeOnBlur: closeOn?.blur ?? true,
		closeOnSelect: !!closeOn?.select,
		closeOnSelectSelector:
			typeof closeOn?.select === "object" && closeOn?.select !== null
				? closeOn.select.cssSelector
				: null,
		closeOnMouseLeaveHitbox: !!(
			closeOn?.mouseLeaveHitbox ?? menuType === "tooltip"
		),
		closeOnEnterContainer: !!(
			closeOn?.enterContainer ?? menuType === "tooltip"
		),
	};
}

/**
 * 2. The Decision Engine Factory
 *
 * Creates an evaluator that takes an interaction signal and decides whether to transition.
 * Enforces hysteresis, delays, and region logic cleanly without mutating state.
 */
export function createTriggerEvaluator(
	rules: MenuEngine.CompiledTriggerRules,
): MenuEngine.TriggerEvaluator {
	return {
		evaluate(
			signal: MenuEngine.InteractionSignal,
			context: { currentRegion: MenuEngine.Region; state: MenuEngine.State },
		): MenuEngine.TransitionDecision {
			const { currentRegion, state } = context;
			const isOpen = state.status === "open" || state.status === "opening";
			const isClosed = state.status === "closed" || state.status === "closing";

			const noop: MenuEngine.TransitionDecision = {
				shouldOpen: false,
				shouldClose: false,
			};

			if (signal === "pointer_down") {
				if (rules.openOnClick && !isOpen)
					return { shouldOpen: true, shouldClose: false, reason: "click" };
				if (rules.openOnLongPress && !isOpen)
					return {
						shouldOpen: true,
						shouldClose: false,
						reason: "longPress",
						delayMs: rules.longPressDelayMs,
					};
			}

			if (signal === "pointer_up") {
				// Cancel long press if the pointer is released before the delay finishes
				if (
					state.status === "opening" &&
					state.transition.reason === "longPress"
				) {
					return {
						shouldOpen: false,
						shouldClose: true,
						reason: "programmatic",
						cancelPrevious: true,
					};
				}
			}

			switch (signal) {
				case "pointer_move":
					if (rules.openOnHover) {
						// Hover over trigger -> open
						if (currentRegion === "trigger" && isClosed) {
							return {
								shouldOpen: true,
								shouldClose: false,
								reason: "hover",
								delayMs: rules.openDelayMs,
								cancelPrevious: true, // cancel any pending closes
							};
						}

						if (isOpen || state.status === "closing") {
							// For tooltips typically, hovering content closes it
							if (currentRegion === "content" && rules.closeOnEnterContainer) {
								return {
									shouldOpen: false,
									shouldClose: true,
									reason: "mouseLeave",
									delayMs: rules.closeDelayMs,
									cancelPrevious: true,
								};
							}

							// If moving into a safe/interactive zone, stay open (cancel pending close)
							if (
								currentRegion === "trigger" ||
								currentRegion === "content" ||
								currentRegion === "safe"
							) {
								if (state.status === "closing") {
									// Pure cancellation brings state back to 'open'
									return {
										shouldOpen: false,
										shouldClose: false,
										cancelPrevious: true,
									};
								}
							}
						}
					}

					// Catch-all for when mouse leaves the hitbox via pointer_move
					if (
						rules.closeOnMouseLeaveHitbox &&
						isOpen &&
						currentRegion === "outside"
					) {
						return {
							shouldOpen: false,
							shouldClose: true,
							reason: "mouseLeave",
							delayMs: rules.closeDelayMs,
							cancelPrevious: true,
						};
					}
					break;

				case "pointer_leave":
					// Evaluated when leaving the entire "hitbox" explicitly
					if (
						rules.closeOnMouseLeaveHitbox &&
						isOpen &&
						currentRegion === "outside"
					) {
						return {
							shouldOpen: false,
							shouldClose: true,
							reason: "mouseLeave",
							delayMs: rules.closeDelayMs,
							cancelPrevious: true,
						};
					}
					// If we are opening and we leave, cancel the opening
					if (
						rules.openOnHover &&
						state.status === "opening" &&
						currentRegion === "outside"
					) {
						return {
							shouldOpen: false,
							shouldClose: false,
							cancelPrevious: true,
						};
					}
					break;

				case "focus_in":
					if (rules.openOnFocus && currentRegion === "trigger" && isClosed) {
						return {
							shouldOpen: true,
							shouldClose: false,
							reason: "focus",
							cancelPrevious: true,
						};
					}
					break;

				case "focus_out":
					if (rules.closeOnBlur && isOpen) {
						return {
							shouldOpen: false,
							shouldClose: true,
							reason: "blur",
							cancelPrevious: true,
						};
					}
					break;

				case "key_escape":
					if (rules.closeOnEscape && isOpen) {
						return {
							shouldOpen: false,
							shouldClose: true,
							reason: "escape",
							cancelPrevious: true,
						};
					}
					break;

				case "interact_outside":
					if (rules.closeOnInteractOutside && isOpen) {
						return {
							shouldOpen: false,
							shouldClose: true,
							reason: "outside",
							cancelPrevious: true,
						};
					}
					break;
			}

			return noop;
		},
	};
}

/**
 * Generates a unique token ID for transitions.
 */
const generateTokenId = () => Math.random().toString(36).slice(2, 9);

/**
 * 3. The State Reducer
 *
 * Applies a transition decision to the state.
 * Returns the new state object, minting tokens if delays are involved.
 */
export function transitionState(
	currentState: MenuEngine.State,
	decision: MenuEngine.TransitionDecision,
): MenuEngine.State {
	// Handle pure cancellation (e.g., hovering back into the menu while it's closing)
	if (!decision.shouldOpen && !decision.shouldClose) {
		if (decision.cancelPrevious) {
			if (currentState.status === "opening") return { status: "closed" };
			if (currentState.status === "closing") return { status: "open" };
		}
		return currentState;
	}

	// Handle Opening
	if (decision.shouldOpen) {
		if (decision.delayMs && decision.delayMs > 0) {
			return {
				status: "opening",
				transition: {
					type: "open",
					reason: decision.reason as Extract<
						MenuEngine.Transition,
						{ type: "open" }
					>["reason"],
				},
				token: {
					id: generateTokenId(),
					type: "open",
					startedAt: Date.now(),
					cancelled: false,
				},
			};
		}
		return { status: "open" };
	}

	// Handle Closing
	if (decision.shouldClose) {
		if (decision.delayMs && decision.delayMs > 0) {
			return {
				status: "closing",
				transition: {
					type: "close",
					reason: decision.reason as Extract<
						MenuEngine.Transition,
						{ type: "close" }
					>["reason"],
				},
				token: {
					id: generateTokenId(),
					type: "close",
					startedAt: Date.now(),
					cancelled: false,
				},
			};
		}
		return { status: "closed" };
	}

	return currentState;
}
