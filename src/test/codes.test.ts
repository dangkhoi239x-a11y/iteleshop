import { describe, expect, it } from "vitest";
import { parseCodeLines } from "@/lib/codes";

describe("parseCodeLines", () => {
  it("splits one code per line and trims whitespace", () => {
    expect(parseCodeLines("  CODE-1 \nCODE-2\n\n CODE-3")).toEqual(["CODE-1", "CODE-2", "CODE-3"]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseCodeLines("")).toEqual([]);
    expect(parseCodeLines(null)).toEqual([]);
    expect(parseCodeLines("   \n \n")).toEqual([]);
  });

  it("drops duplicate codes so one code is never sold twice", () => {
    expect(parseCodeLines("A\nA\nB\nA")).toEqual(["A", "B"]);
  });

  it("caps a single paste at 500 codes", () => {
    const many = Array.from({ length: 600 }, (_, i) => `C-${i}`).join("\n");
    expect(parseCodeLines(many)).toHaveLength(500);
  });
});
