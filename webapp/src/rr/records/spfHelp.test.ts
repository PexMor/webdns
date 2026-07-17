import { describe, expect, it } from "vitest";
import { getSpfMechanismHelp, spfHelpTriggerParts, spfMechanismKey } from "./spfHelp";
import { parseSpfTerm } from "./spf";

describe("spfMechanismKey", () => {
  it("recognizes common mechanisms", () => {
    expect(spfMechanismKey(parseSpfTerm("v=spf1"))).toBe("v=spf1");
    expect(spfMechanismKey(parseSpfTerm("mx"))).toBe("mx");
    expect(spfMechanismKey(parseSpfTerm("-all"))).toBe("all");
    expect(spfMechanismKey(parseSpfTerm("ip4:1.2.3.4"))).toBe("ip4");
    expect(spfMechanismKey(parseSpfTerm("include:_spf.example.com"))).toBe("include");
  });
});

describe("getSpfMechanismHelp", () => {
  it("returns help for bare mx and qualifier all mechanisms", () => {
    expect(getSpfMechanismHelp(parseSpfTerm("mx"))).toEqual(
      expect.objectContaining({ title: "mx" })
    );
    expect(getSpfMechanismHelp(parseSpfTerm("~all"))).toEqual(
      expect.objectContaining({ title: "~all" })
    );
  });

  it("returns help for mechanism prefixes on actionable terms", () => {
    expect(getSpfMechanismHelp(parseSpfTerm("ip4:1.2.3.4"))).toEqual(
      expect.objectContaining({ title: "ip4:" })
    );
  });

  it("returns null for terms without help", () => {
    expect(getSpfMechanismHelp(parseSpfTerm("exists:%{i}.example.com"))).toBeNull();
  });
});

describe("spfHelpTriggerParts", () => {
  it("uses the full raw term for non-actionable mechanisms", () => {
    expect(spfHelpTriggerParts(parseSpfTerm("-all"))).toEqual({ label: "-all", separator: "" });
  });

  it("puts the colon outside the label for actionable mechanisms", () => {
    expect(spfHelpTriggerParts(parseSpfTerm("include:_spf.example.com"))).toEqual({
      label: "include",
      separator: ":",
    });
    expect(spfHelpTriggerParts(parseSpfTerm("ip4:1.2.3.4"))).toEqual({
      label: "ip4",
      separator: ":",
    });
  });
});
