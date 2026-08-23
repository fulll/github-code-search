/**
 * Scroll cooldown logic to prevent accidental selection during/after trackpad momentum scrolling.
 * Trackpads can send scroll events for 400-1000ms after the physical gesture ends (momentum).
 */

export interface ScrollCooldownState {
  lastScrollTime: number;
  isActive: boolean;
}

const SCROLL_COOLDOWN_MS = 600; // milliseconds — conservative for trackpad momentum

export function createScrollCooldownState(): ScrollCooldownState {
  return {
    lastScrollTime: 0,
    isActive: false,
  };
}

export function recordScroll(
  state: ScrollCooldownState,
  now: number = Date.now(),
): ScrollCooldownState {
  return {
    ...state,
    lastScrollTime: now,
    isActive: true,
  };
}

export function isScrollCooldownActive(
  state: ScrollCooldownState,
  now: number = Date.now(),
): boolean {
  if (!state.isActive) return false;
  const elapsed = now - state.lastScrollTime;
  return elapsed < SCROLL_COOLDOWN_MS;
}

export function updateScrollCooldown(
  state: ScrollCooldownState,
  now: number = Date.now(),
): ScrollCooldownState {
  if (!isScrollCooldownActive(state, now)) {
    return {
      ...state,
      isActive: false,
    };
  }
  return state;
}
