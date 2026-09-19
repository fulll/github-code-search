import { afterEach, describe, expect, it } from "bun:test";
import { getGhAuthToken, resolveGhAuthToken } from "./gh-cli.ts";

const ghIsAvailable = () => true;
const ghAuthTokenSucceeds = () => ({ exitCode: 0, stdout: "token-value" });

describe("resolveGhAuthToken", () => {
  it("returns undefined when gh is not installed", () => {
    const result = resolveGhAuthToken(
      () => false,
      () => {
        throw new Error("runAuthToken must not be called when gh isn't installed");
      },
    );
    expect(result).toBeUndefined();
  });

  it("returns the trimmed token when gh auth token succeeds", () => {
    const result = resolveGhAuthToken(
      () => true,
      () => ({ exitCode: 0, stdout: "ghp_abc123\n" }),
    );
    expect(result).toBe("ghp_abc123");
  });

  it("returns undefined when gh auth token exits with a non-zero code", () => {
    const result = resolveGhAuthToken(
      () => true,
      () => ({ exitCode: 1, stdout: "" }),
    );
    expect(result).toBeUndefined();
  });

  it("returns undefined when gh auth token succeeds but prints only whitespace", () => {
    const result = resolveGhAuthToken(
      () => true,
      () => ({ exitCode: 0, stdout: "   \n" }),
    );
    expect(result).toBeUndefined();
  });

  it("is pure — calling it twice with the same inputs yields the same result", () => {
    const first = resolveGhAuthToken(ghIsAvailable, ghAuthTokenSucceeds);
    const second = resolveGhAuthToken(ghIsAvailable, ghAuthTokenSucceeds);
    expect(first).toBe(second);
  });
});

describe("getGhAuthToken", () => {
  const originalWhich = Bun.which;
  const originalSpawnSync = Bun.spawnSync;

  afterEach(() => {
    Bun.which = originalWhich;
    Bun.spawnSync = originalSpawnSync;
  });

  it("returns undefined when gh is not on PATH (Bun.spawnSync never called)", () => {
    Bun.which = (() => null) as typeof Bun.which;
    Bun.spawnSync = (() => {
      throw new Error("spawnSync must not be called when gh isn't on PATH");
    }) as unknown as typeof Bun.spawnSync;
    expect(getGhAuthToken()).toBeUndefined();
  });

  it("returns the trimmed token when gh is on PATH and gh auth token succeeds", () => {
    Bun.which = (() => "/usr/local/bin/gh") as typeof Bun.which;
    Bun.spawnSync = ((..._args: unknown[]) => ({
      exitCode: 0,
      stdout: Buffer.from("ghp_real123\n"),
    })) as unknown as typeof Bun.spawnSync;
    expect(getGhAuthToken()).toBe("ghp_real123");
  });

  it("returns undefined when gh auth token exits non-zero (not authenticated)", () => {
    Bun.which = (() => "/usr/local/bin/gh") as typeof Bun.which;
    Bun.spawnSync = ((..._args: unknown[]) => ({
      exitCode: 1,
      stdout: Buffer.from(""),
    })) as unknown as typeof Bun.spawnSync;
    expect(getGhAuthToken()).toBeUndefined();
  });
});
