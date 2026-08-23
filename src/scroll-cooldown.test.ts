import { describe, it, expect } from "bun:test";
import {
  createScrollCooldownState,
  recordScroll,
  isScrollCooldownActive,
  updateScrollCooldown,
} from "./scroll-cooldown";

describe("scroll-cooldown", () => {
  it("should create initial state with isActive false", () => {
    const state = createScrollCooldownState();
    expect(state.isActive).toBe(false);
    expect(state.lastScrollTime).toBe(0);
  });

  it("should mark cooldown active after recording a scroll", () => {
    const state = createScrollCooldownState();
    const now = Date.now();
    const updated = recordScroll(state);
    expect(updated.isActive).toBe(true);
    expect(updated.lastScrollTime).toBe(now);
  });

  it("should report cooldown active immediately after scroll", () => {
    const state = createScrollCooldownState();
    const now = Date.now();
    const updated = recordScroll(state);
    expect(isScrollCooldownActive(updated, now)).toBe(true);
  });

  it("should report cooldown active within cooldown window", () => {
    const state = createScrollCooldownState();
    const now = 1000;
    const updated = recordScroll(state);
    updated.lastScrollTime = now;
    // 100ms later, should still be active (cooldown is 600ms)
    expect(isScrollCooldownActive(updated, now + 100)).toBe(true);
  });

  it("should report cooldown inactive after timeout", () => {
    const state = createScrollCooldownState();
    const now = 1000;
    const updated = recordScroll(state);
    updated.lastScrollTime = now;
    // 700ms later, should be inactive (cooldown is 600ms)
    expect(isScrollCooldownActive(updated, now + 700)).toBe(false);
  });

  it("should handle multiple scrolls by extending the cooldown window", () => {
    let state = createScrollCooldownState();
    const t0 = 1000;
    const t1 = t0 + 100; // First scroll at 1000
    const t2 = t0 + 200; // Second scroll at 1100

    state = recordScroll(state);
    state.lastScrollTime = t1;
    expect(isScrollCooldownActive(state, t2)).toBe(true);

    // Record another scroll at t2
    state = recordScroll(state);
    state.lastScrollTime = t2;

    // At t2 + 500 (still within 600ms of t2), should be active
    expect(isScrollCooldownActive(state, t2 + 500)).toBe(true);

    // At t2 + 700 (past 600ms of t2), should be inactive
    expect(isScrollCooldownActive(state, t2 + 700)).toBe(false);
  });

  it("should return isActive=false after updateScrollCooldown when expired", () => {
    let state = createScrollCooldownState();
    const now = 1000;
    state = recordScroll(state);
    state.lastScrollTime = now;

    // At now + 700ms (past 600ms cooldown), update should clear isActive
    const updated = updateScrollCooldown(state, now + 700);
    expect(updated.isActive).toBe(false);
  });

  it("should preserve isActive=true if cooldown still active", () => {
    let state = createScrollCooldownState();
    const now = 1000;
    state = recordScroll(state);
    state.lastScrollTime = now;

    // At now + 100ms (within 600ms), update should keep isActive
    const updated = updateScrollCooldown(state, now + 100);
    expect(updated.isActive).toBe(true);
  });
});
