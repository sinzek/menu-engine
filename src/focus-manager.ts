/**
 * Per-menu focus controller. Implements roving tabindex semantics
 * (one focusable item at a time, arrow keys move focus, typeahead jumps).
 *
 * Items are tracked imperatively so item registration / focus changes do not
 * trigger React re-renders. The `subscribe` channel exists for consumers that
 * want to render selection state (highlights, badges) reactively.
 */

export type FocusableItem = {
	/** Stable identifier for the item, scoped to this manager. */
	id: string;
	/** The element to focus. */
	el: HTMLElement;
	/** Whether the item is disabled. */
	disabled: boolean;
	/** Text used for typeahead matching. Falls back to el.textContent. */
	textValue?: string;
	/** Called for Enter/Space. If omitted, a synthetic click is dispatched. */
	onActivate?: () => void;
	/** Called for ArrowRight (used by submenu triggers to open). */
	onArrowRight?: () => void;
};

type Listener = () => void;

const TYPEAHEAD_RESET_MS = 500;

/** Manages focus for a single menu. */
export class MenuFocusManager {
	private items: FocusableItem[] = [];
	private currentId: string | null = null;
	private listeners = new Set<Listener>();
	private typeaheadBuf = "";
	private typeaheadTimer: ReturnType<typeof setTimeout> | null = null;

	private arrowLeftHandler: (() => void) | null = null;

	subscribe = (listener: Listener) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	private notify() {
		this.listeners.forEach((l) => l());
	}

	getCurrentId = (): string | null => this.currentId;

	getItems = (): readonly FocusableItem[] => this.items;

	register = (item: FocusableItem): (() => void) => {
		// replace if same id re-registers (e.g., ref changed after a re-render)
		const idx = this.items.findIndex((i) => i.id === item.id);
		if (idx >= 0) this.items[idx] = item;
		else this.items.push(item);
		this.sortByDom();
		this.applyTabIndex();
		this.notify();
		return () => this.unregister(item.id);
	};

	unregister = (id: string) => {
		this.items = this.items.filter((i) => i.id !== id);
		if (this.currentId === id) this.currentId = null;
		this.applyTabIndex();
		this.notify();
	};

	private sortByDom() {
		this.items.sort((a, b) => {
			if (!a.el.isConnected || !b.el.isConnected) return 0;
			const pos = a.el.compareDocumentPosition(b.el);
			if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
			if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
			return 0;
		});
	}

	private applyTabIndex() {
		for (const item of this.items) {
			const isCurrent = item.id === this.currentId;
			item.el.tabIndex = isCurrent ? 0 : -1;
			if (isCurrent) item.el.setAttribute("data-current", "");
			else item.el.removeAttribute("data-current");
		}
	}

	private enabled(): FocusableItem[] {
		return this.items.filter((i) => !i.disabled && i.el.isConnected);
	}

	setCurrent = (id: string | null, focus = false) => {
		if (this.currentId === id) {
			if (focus && id) {
				const it = this.items.find((i) => i.id === id);
				it?.el.focus();
			}
			return;
		}
		this.currentId = id;
		this.applyTabIndex();
		if (focus && id) {
			const it = this.items.find((i) => i.id === id);
			it?.el.focus();
		}
		this.notify();
	};

	current = (): FocusableItem | null =>
		this.currentId
			? (this.items.find((i) => i.id === this.currentId) ?? null)
			: null;

	first = () => {
		const item = this.enabled()[0];
		if (item) this.setCurrent(item.id, true);
	};

	last = () => {
		const list = this.enabled();
		const item = list[list.length - 1];
		if (item) this.setCurrent(item.id, true);
	};

	next = () => {
		const list = this.enabled();
		if (!list.length) return;
		const idx = this.currentId
			? list.findIndex((i) => i.id === this.currentId)
			: -1;
		const target = list[(idx + 1) % list.length];
		this.setCurrent(target.id, true);
	};

	prev = () => {
		const list = this.enabled();
		if (!list.length) return;
		const idx = this.currentId
			? list.findIndex((i) => i.id === this.currentId)
			: 0;
		const target = list[(idx - 1 + list.length) % list.length];
		this.setCurrent(target.id, true);
	};

	typeahead = (char: string) => {
		if (this.typeaheadTimer) clearTimeout(this.typeaheadTimer);
		this.typeaheadBuf += char.toLowerCase();
		const buf = this.typeaheadBuf;
		const list = this.enabled();
		if (list.length) {
			const startIdx =
				(this.currentId ? list.findIndex((i) => i.id === this.currentId) : -1) +
				1;
			for (let offset = 0; offset < list.length; offset++) {
				const item = list[(startIdx + offset) % list.length];
				const text = (item.textValue ?? item.el.textContent ?? "")
					.trim()
					.toLowerCase();
				if (text.startsWith(buf)) {
					this.setCurrent(item.id, true);
					break;
				}
			}
		}
		this.typeaheadTimer = setTimeout(() => {
			this.typeaheadBuf = "";
		}, TYPEAHEAD_RESET_MS);
	};

	activate = () => {
		const cur = this.current();
		if (!cur || cur.disabled) return;
		if (cur.onActivate) cur.onActivate();
		else cur.el.click();
	};

	arrowRight = () => {
		const cur = this.current();
		cur?.onArrowRight?.();
	};

	setArrowLeftHandler = (fn: (() => void) | null) => {
		this.arrowLeftHandler = fn;
	};

	arrowLeft = (): boolean => {
		if (!this.arrowLeftHandler) return false;
		this.arrowLeftHandler();
		return true;
	};

	clear = () => {
		this.setCurrent(null);
		this.typeaheadBuf = "";
		if (this.typeaheadTimer) clearTimeout(this.typeaheadTimer);
	};
}
