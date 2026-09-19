import { describe, expect, it } from "bun:test";
import { resolveGhAuthToken } from "./gh-cli.ts";

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
