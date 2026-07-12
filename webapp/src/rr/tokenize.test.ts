import { describe, expect, it } from "vitest";
import { isInteger, joinBlob, takePositional, tokenize } from "./tokenize";

describe("tokenize", () => {
  it("splits plain whitespace-separated tokens", () => {
    expect(tokenize("10 mail.example.com.")).toEqual(["10", "mail.example.com."]);
  });

  it("keeps quoted character-strings as single tokens with quotes stripped", () => {
    expect(tokenize('0 issue "letsencrypt.org"')).toEqual(["0", "issue", "letsencrypt.org"]);
  });

  it("preserves spaces inside quoted character-strings", () => {
    expect(tokenize('"v=spf1 include:_spf.example.com ~all"')).toEqual([
      "v=spf1 include:_spf.example.com ~all",
    ]);
  });

  it("handles escaped quotes inside a character-string", () => {
    expect(tokenize('"a \\"b\\" c"')).toEqual(['a "b" c']);
  });

  it("strips cosmetic line-wrap parentheses", () => {
    expect(tokenize("ns1.example.com. hostmaster.example.com. (2025071001 7200 3600 1209600 300)")).toEqual([
      "ns1.example.com.",
      "hostmaster.example.com.",
      "2025071001",
      "7200",
      "3600",
      "1209600",
      "300",
    ]);
  });

  it("handles multiple quoted strings in one record", () => {
    expect(tokenize('100 10 "u" "E2U+sip" "!^.*$!sip:alice@example.com!" .')).toEqual([
      "100",
      "10",
      "u",
      "E2U+sip",
      "!^.*$!sip:alice@example.com!",
      ".",
    ]);
  });

  it("returns an empty array for an empty string", () => {
    expect(tokenize("")).toEqual([]);
  });
});

describe("isInteger", () => {
  it("accepts positive and negative integer tokens", () => {
    expect(isInteger("123")).toBe(true);
    expect(isInteger("-5")).toBe(true);
  });

  it("rejects non-integer tokens", () => {
    expect(isInteger("abc")).toBe(false);
    expect(isInteger("1.5")).toBe(false);
    expect(isInteger(undefined)).toBe(false);
  });
});

describe("takePositional", () => {
  it("splits the requested number of leading tokens from the rest", () => {
    expect(takePositional(["1", "2", "3", "4"], 2)).toEqual({
      head: ["1", "2"],
      rest: ["3", "4"],
    });
  });

  it("returns null when there are fewer tokens than requested", () => {
    expect(takePositional(["1"], 2)).toBeNull();
  });
});

describe("joinBlob", () => {
  it("concatenates tokens without separators", () => {
    expect(joinBlob(["abc", "def", "ghi"])).toBe("abcdefghi");
  });
});
