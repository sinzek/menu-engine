import type { MenuEngine } from "./core.ts";

/**
 * Checks if a given (x,y) point is inside a DOMRect.
 */
export function isPointInRect(x: number, y: number, rect: DOMRect): boolean {
	return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Checks if a given (x,y) point is inside a polygon using the ray-casting algorithm.
 */
export function isPointInPolygon(
	x: number,
	y: number,
	polygon: MenuEngine.Point[],
): boolean {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i].x,
			yi = polygon[i].y;
		const xj = polygon[j].x,
			yj = polygon[j].y;

		const intersect =
			yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

/**
 * Calculates a "safe bridge" polygon (the Amazon hover triangle) connecting
 * the point where the cursor left the trigger to the bounds of the content menu.
 *
 * This prevents the menu from closing when the user moves their mouse diagonally
 * from the trigger to the menu over empty space or other elements.
 */
export function calculateSafeBridge(
	cursorExitPoint: MenuEngine.Point,
	contentRect: DOMRect,
): MenuEngine.Point[] {
	// Determine the relative position of the cursor to the content
	const isLeft = cursorExitPoint.x < contentRect.left;
	const isRight = cursorExitPoint.x > contentRect.right;
	const isTop = cursorExitPoint.y < contentRect.top;
	const isBottom = cursorExitPoint.y > contentRect.bottom;

	const corners: MenuEngine.Point[] = [];

	// Map the opposite/tangent corners of the content rect to form the widest
	// possible triangle/polygon facing the cursor.
	if (isLeft && isTop) {
		corners.push({ x: contentRect.right, y: contentRect.top });
		corners.push({ x: contentRect.left, y: contentRect.bottom });
	} else if (isLeft && isBottom) {
		corners.push({ x: contentRect.left, y: contentRect.top });
		corners.push({ x: contentRect.right, y: contentRect.bottom });
	} else if (isRight && isTop) {
		corners.push({ x: contentRect.left, y: contentRect.top });
		corners.push({ x: contentRect.right, y: contentRect.bottom });
	} else if (isRight && isBottom) {
		corners.push({ x: contentRect.right, y: contentRect.top });
		corners.push({ x: contentRect.left, y: contentRect.bottom });
	} else if (isLeft) {
		corners.push({ x: contentRect.right, y: contentRect.top });
		corners.push({ x: contentRect.right, y: contentRect.bottom });
	} else if (isRight) {
		corners.push({ x: contentRect.left, y: contentRect.top });
		corners.push({ x: contentRect.left, y: contentRect.bottom });
	} else if (isTop) {
		corners.push({ x: contentRect.left, y: contentRect.bottom });
		corners.push({ x: contentRect.right, y: contentRect.bottom });
	} else if (isBottom) {
		corners.push({ x: contentRect.left, y: contentRect.top });
		corners.push({ x: contentRect.right, y: contentRect.top });
	}

	// The polygon is the cursor point + the two extremities of the target rect
	return [cursorExitPoint, ...corners];
}

/**
 * Resolves the raw mouse coordinates into a semantic Region.
 */
export function resolveRegion(
	x: number,
	y: number,
	rects: MenuEngine.RegionRects,
): MenuEngine.Region {
	if (isPointInRect(x, y, rects.trigger)) {
		return "trigger";
	}

	if (rects.content && isPointInRect(x, y, rects.content)) {
		return "content";
	}

	if (rects.safe && isPointInPolygon(x, y, rects.safe)) {
		return "safe";
	}

	return "outside";
}
