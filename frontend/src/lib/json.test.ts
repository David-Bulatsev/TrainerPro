import { describe, expect, it } from "vitest";

import { safeParseJson } from "./json";

describe("safeParseJson", () => {
  it("returns parsed value for valid json", () => {
    expect(safeParseJson('{"a":1}', { a: 0 })).toEqual({ a: 1 });
  });

  it("returns fallback for invalid json", () => {
    expect(safeParseJson("{bad", { a: 2 })).toEqual({ a: 2 });
  });

  it("returns fallback for empty input", () => {
    expect(safeParseJson(undefined, { a: 3 })).toEqual({ a: 3 });
  });
});
