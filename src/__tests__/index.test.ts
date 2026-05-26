import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { menus } from "../registry.ts";
import { MenuStore } from "../store.ts";
import { compileTriggerRules, createTriggerEvaluator, transitionState } from "../engine.ts";
import type { Menu, MenuEngine } from "../core.ts";

describe("Menu Engine State Machine & Store Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("1. Trigger Compiler Default Rules", () => {
    it("should compile default rules for Popover correcty", () => {
      const popoverRules = compileTriggerRules(undefined, "popover");
      expect(popoverRules.openOnClick).toBe(true);
      expect(popoverRules.openOnHover).toBe(false);
      expect(popoverRules.closeOnClick).toBe(true);
      expect(popoverRules.closeOnEscape).toBe(true);
      expect(popoverRules.closeOnInteractOutside).toBe(true);
      expect(popoverRules.closeOnMouseLeaveHitbox).toBe(false);
    });

    it("should compile default rules for Tooltip correctly", () => {
      const tooltipRules = compileTriggerRules(undefined, "tooltip");
      expect(tooltipRules.openOnClick).toBe(false);
      expect(tooltipRules.openOnHover).toBe(true);
      expect(tooltipRules.closeOnClick).toBe(true);
      expect(tooltipRules.closeOnMouseLeaveHitbox).toBe(true);
      expect(tooltipRules.closeOnEnterContainer).toBe(true);
    });

    it("should compile default rules for Dropdown correctly", () => {
      const dropdownRules = compileTriggerRules(undefined, "dropdown");
      expect(dropdownRules.openOnClick).toBe(true);
      expect(dropdownRules.openOnHover).toBe(false);
      expect(dropdownRules.closeOnClick).toBe(true);
      expect(dropdownRules.closeOnEscape).toBe(true);
    });

    it("should respect user overrides for delays and behavior", () => {
      const customConfig: Menu.Trigger = {
        openOn: {
          hover: { delayMs: 150 },
          longPress: { minDurationMs: 400 },
        },
        closeOn: {
          mouseLeaveHitbox: { delayMs: 250 },
        },
        behavior: {
          hysteresisMs: 50,
        },
      };

      const rules = compileTriggerRules(customConfig, "popover");
      expect(rules.openDelayMs).toBe(150);
      expect(rules.closeDelayMs).toBe(250);
      expect(rules.hysteresisMs).toBe(50);
      expect(rules.longPressDelayMs).toBe(400);
      expect(rules.openOnHover).toBe(true);
    });
  });

  describe("2. Pure Reducer State Transitions (transitionState)", () => {
    const defaultState: MenuEngine.State = { status: "closed" };

    it("should transition from closed to open immediately if no delay is set", () => {
      const decision: MenuEngine.TransitionDecision = {
        shouldOpen: true,
        shouldClose: false,
        reason: "click",
      };
      const nextState = transitionState(defaultState, decision);
      expect(nextState.status).toBe("open");
    });

    it("should transition from closed to opening if a delay is set", () => {
      const decision: MenuEngine.TransitionDecision = {
        shouldOpen: true,
        shouldClose: false,
        reason: "hover",
        delayMs: 200,
      };
      const nextState = transitionState(defaultState, decision);
      expect(nextState.status).toBe("opening");
      if (nextState.status === "opening") {
        expect(nextState.transition.type).toBe("open");
        expect(nextState.transition.reason).toBe("hover");
        expect(nextState.token).toBeDefined();
        expect(nextState.token.cancelled).toBe(false);
      }
    });

    it("should transition from open to closing if a close delay is set", () => {
      const openState: MenuEngine.State = { status: "open" };
      const decision: MenuEngine.TransitionDecision = {
        shouldOpen: false,
        shouldClose: true,
        reason: "mouseLeave",
        delayMs: 300,
      };
      const nextState = transitionState(openState, decision);
      expect(nextState.status).toBe("closing");
      if (nextState.status === "closing") {
        expect(nextState.transition.type).toBe("close");
        expect(nextState.transition.reason).toBe("mouseLeave");
      }
    });

    it("should handle pure transition cancellation (hover back into menu while closing)", () => {
      const closingState: MenuEngine.State = {
        status: "closing",
        transition: { type: "close", reason: "mouseLeave" },
        token: { id: "tok1", type: "close", startedAt: Date.now(), cancelled: false },
      };
      const decision: MenuEngine.TransitionDecision = {
        shouldOpen: false,
        shouldClose: false,
        cancelPrevious: true,
      };
      const nextState = transitionState(closingState, decision);
      expect(nextState.status).toBe("open");
    });
  });

  describe("3. MenuStore Imperative API and State Changes", () => {
    it("should initialize as closed by default", () => {
      const store = new MenuStore({ type: "popover" });
      expect(store.isOpen()).toBe(false);
      expect(store.getStatus()).toBe("closed");
    });

    it("should initialize as open if defaultOpen config is true", () => {
      const store = new MenuStore({ type: "popover", defaultOpen: true });
      expect(store.isOpen()).toBe(true);
      expect(store.getStatus()).toBe("open");
    });

    it("should open and close imperatively", () => {
      const store = new MenuStore({ type: "popover" });
      
      store.open();
      expect(store.isOpen()).toBe(true);
      expect(store.getStatus()).toBe("open");

      store.close();
      expect(store.isOpen()).toBe(false);
      expect(store.getStatus()).toBe("closed");
    });

    it("should toggle open state correctly", () => {
      const store = new MenuStore({ type: "popover" });
      
      store.toggle();
      expect(store.getStatus()).toBe("open");

      // Reset the single-interaction toggle guard
      store.handlePointerUp();
      vi.advanceTimersByTime(0);

      store.toggle();
      expect(store.getStatus()).toBe("closed");
    });

    it("should open at custom coordinate anchor point", () => {
      const store = new MenuStore({ type: "popover" });
      store.openAt(150, 300);
      
      expect(store.isOpen()).toBe(true);
      expect(store.getAnchor()).toEqual({
        type: "point",
        point: { x: 150, y: 300 },
      });
    });

    it("should handle and notify state subscriptions", () => {
      const store = new MenuStore({ type: "popover" });
      const stateSpy = vi.fn();
      const unsubscribe = store.subscribe(stateSpy);

      store.open();
      expect(stateSpy).toHaveBeenCalledTimes(1);

      store.close();
      expect(stateSpy).toHaveBeenCalledTimes(2);

      unsubscribe();
      store.open();
      expect(stateSpy).toHaveBeenCalledTimes(2); // No new invocation
    });
  });

  describe("4. Delayed Interactions & Hysteresis using Fake Timers", () => {
    it("should delay opening when openOnHover has a delay", () => {
      const store = new MenuStore({
        type: "tooltip",
        trigger: {
          openOn: { hover: { delayMs: 200 } },
        },
      });

      store.updateRegion("trigger"); // simulates hover trigger
      expect(store.getStatus()).toBe("opening");

      // Fast-forward only 100ms (delay is 200ms)
      vi.advanceTimersByTime(100);
      expect(store.getStatus()).toBe("opening");

      // Fast-forward the rest
      vi.advanceTimersByTime(100);
      expect(store.getStatus()).toBe("open");
    });

    it("should cancel opening if cursor leaves trigger before hover delay finishes", () => {
      const store = new MenuStore({
        type: "tooltip",
        trigger: {
          openOn: { hover: { delayMs: 200 } },
        },
      });

      store.updateRegion("trigger");
      expect(store.getStatus()).toBe("opening");

      vi.advanceTimersByTime(100);
      // Leaves the hitbox before 200ms
      store.updateRegion("outside");
      expect(store.getStatus()).toBe("closed");

      // Verify that completing the original 200ms timer doesn't mistakenly open the menu
      vi.advanceTimersByTime(100);
      expect(store.getStatus()).toBe("closed");
    });

    it("should delay closing when closeOnMouseLeaveHitbox has a delay", () => {
      const store = new MenuStore({
        type: "tooltip",
        trigger: {
          openOn: { hover: true },
          closeOn: { mouseLeaveHitbox: { delayMs: 300 } },
        },
      });

      store.open();
      expect(store.getStatus()).toBe("open");

      // The menu is open; move the cursor onto the trigger first
      store.updateRegion("trigger");
      expect(store.getRegion()).toBe("trigger");

      // Now move outside the hitbox to trigger the close delay
      store.updateRegion("outside");
      expect(store.getStatus()).toBe("closing");

      // Moving mouse back to trigger cancels the close delay
      vi.advanceTimersByTime(150);
      store.updateRegion("trigger");
      expect(store.getStatus()).toBe("open");

      // Fast forward the rest of original 300ms, should stay open
      vi.advanceTimersByTime(150);
      expect(store.getStatus()).toBe("open");
    });
  });

  describe("5. Keyboard & Spatial Event Dispatches", () => {
    it("should close open menu on key_escape", () => {
      const store = new MenuStore({ type: "popover" });
      store.open();
      
      store.dispatch("key_escape");
      expect(store.getStatus()).toBe("closed");
    });

    it("should close open menu on interact_outside", () => {
      const store = new MenuStore({ type: "popover" });
      store.open();
      
      store.dispatch("interact_outside");
      expect(store.getStatus()).toBe("closed");
    });

    it("should open menu on focus_in and close on focus_out (blur)", () => {
      const store = new MenuStore({
        type: "dropdown",
        trigger: {
          openOn: { focus: true },
          closeOn: { blur: true },
        },
      });

      store.updateRegion("trigger");
      store.dispatch("focus_in");
      expect(store.getStatus()).toBe("open");

      store.dispatch("focus_out");
      expect(store.getStatus()).toBe("closed");
    });
  });

  describe("6. Long Press Transitions", () => {
    it("should handle long press flow perfectly", () => {
      const store = new MenuStore({
        type: "popover",
        trigger: {
          openOn: {
            click: false, // Must disable click so pointer_down initiates longPress delay
            longPress: { minDurationMs: 500 },
          },
        },
      });

      store.dispatch("pointer_down");
      expect(store.getStatus()).toBe("opening");

      // Releasing pointer before 500ms should cancel it
      vi.advanceTimersByTime(250);
      store.dispatch("pointer_up");
      expect(store.getStatus()).toBe("closed");

      // Trying again, holding for full duration
      store.dispatch("pointer_down");
      expect(store.getStatus()).toBe("opening");

      vi.advanceTimersByTime(500);
      expect(store.getStatus()).toBe("open");
    });
  });

  describe("7. Item Selection (select)", () => {
    it("should trigger onSelect callback", () => {
      const selectSpy = vi.fn();
      const store = new MenuStore({
        type: "dropdown",
        events: { onSelect: selectSpy },
      });

      const eventPayload: Menu.Events.PointerInteraction = {
        type: "click",
        x: 10,
        y: 20,
        button: 0,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        timestamp: Date.now(),
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; },
        target: {},
        currentTarget: {},
      };

      store.select(eventPayload);
      expect(selectSpy).toHaveBeenCalledTimes(1);
    });

    it("should auto-close on selection when configured", () => {
      const store = new MenuStore({
        type: "dropdown",
        trigger: {
          closeOn: { select: true },
        },
      });

      store.open();
      expect(store.isOpen()).toBe(true);

      const eventPayload = {
        type: "click" as const,
        x: 0,
        y: 0,
        button: 0,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        timestamp: Date.now(),
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() {},
        stopPropagation() {},
        target: {},
        currentTarget: {},
      };

      store.select(eventPayload);
      expect(store.getStatus()).toBe("closed");
    });
  });

  describe("8. Hierarchy & Cascading Closes (Submenus)", () => {
    it("should close children submenus recursively when parent closes", () => {
      const parent = new MenuStore({ type: "dropdown" });
      const child = new MenuStore({ type: "dropdown" });
      const grandChild = new MenuStore({ type: "dropdown" });

      child.setParent(parent);
      grandChild.setParent(child);

      parent.open();
      child.open();
      grandChild.open();

      expect(parent.isOpen()).toBe(true);
      expect(child.isOpen()).toBe(true);
      expect(grandChild.isOpen()).toBe(true);
      expect(parent.hasOpenDescendant()).toBe(true);

      // Closing parent should cascade-close child and grandchild
      parent.close();
      expect(parent.isOpen()).toBe(false);
      expect(child.isOpen()).toBe(false);
      expect(grandChild.isOpen()).toBe(false);
      expect(parent.hasOpenDescendant()).toBe(false);
    });
  });

  describe("9. Global MenuRegistry (menus)", () => {
    it("should register and fetch global menu instances", () => {
      const config = { id: "test-menu", type: "popover" } as const;
      const store = menus.create(config);

      expect(store).toBeInstanceOf(MenuStore);
      expect(menus.get("test-menu")).toBe(store);

      // Re-creating with same ID returns cached store
      const store2 = menus.create(config);
      expect(store2).toBe(store);

      // Can remove from registry
      menus.remove("test-menu");
      expect(menus.get("test-menu")).toBeUndefined();
    });
  });

  describe("10. Cleanups and Memory-Leak Prevention (dispose)", () => {
    it("should clear timers, remove child-parent linkage, and purge listeners upon dispose", () => {
      const parent = new MenuStore({ type: "dropdown" });
      const child = new MenuStore({ type: "dropdown" });
      child.setParent(parent);

      expect(parent.getChildren().has(child)).toBe(true);
      expect(child.getParent()).toBe(parent);

      const spy = vi.fn();
      child.subscribe(spy);

      // Trigger delayed hover open
      const delayedStore = new MenuStore({
        type: "tooltip",
        trigger: { openOn: { hover: { delayMs: 200 } } },
      });
      delayedStore.updateRegion("trigger");
      expect(delayedStore.getStatus()).toBe("opening");

      // Dispose child and delayedStore
      child.dispose();
      delayedStore.dispose();

      // Check linkages are broken
      expect(parent.getChildren().has(child)).toBe(false);
      expect(child.getParent()).toBeUndefined();

      // Tick the timers, delayedStore should not update because it's cleared
      vi.advanceTimersByTime(200);
      expect(delayedStore.getStatus()).toBe("opening"); // remains in "opening" state, timer cancelled

      // Emit transition changes, should not trigger listener spy
      child.open();
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
