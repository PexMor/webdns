import { describe, expect, it } from "vitest";
import "./records";
import { getRrTypeEntry } from "./registry";
import { RECORD_TYPE_HELP, extractExampleRdata } from "../recordTypeHelp";
import { RECORD_TYPES } from "../recordTypes";

describe("record type help examples parse via the registry", () => {
  it.each(RECORD_TYPES)("%s has a registered entry whose example parses", (type) => {
    const entry = getRrTypeEntry(type);
    expect(entry, `no registry entry for ${type}`).toBeDefined();

    const help = RECORD_TYPE_HELP[type];
    expect(help?.example, `no example for ${type}`).toBeTruthy();

    const rdata = extractExampleRdata(help!.example!);
    expect(rdata, `could not extract RDATA from example for ${type}`).not.toBeNull();

    const parsed = entry!.parse(rdata!);
    expect(parsed, `parser rejected the example RDATA for ${type}: ${rdata}`).not.toBeNull();
  });
});
