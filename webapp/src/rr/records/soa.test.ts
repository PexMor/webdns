import { describe, expect, it } from "vitest";
import { decodeSoaRname } from "./soa";

describe("decodeSoaRname", () => {
  it("decodes a well-formed rname", () => {
    expect(decodeSoaRname("hostmaster.example.com")).toBe("hostmaster@example.com");
  });

  it("decodes an rname with a trailing FQDN dot", () => {
    expect(decodeSoaRname("hostmaster.example.com.")).toBe("hostmaster@example.com");
  });

  it("treats an escaped dot in the local part as literal, not a separator", () => {
    expect(decodeSoaRname("john\\.doe.example.com")).toBe("john.doe@example.com");
  });

  it("returns null when there is no separator (bare label)", () => {
    expect(decodeSoaRname("hostmaster")).toBeNull();
  });

  it("returns null for an empty value", () => {
    expect(decodeSoaRname("")).toBeNull();
  });

  it("returns null when the local part is empty", () => {
    expect(decodeSoaRname(".example.com")).toBeNull();
  });
});
