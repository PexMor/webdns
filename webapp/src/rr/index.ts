export * from "./types";
export { getRrTypeEntry, registerRrTypes } from "./registry";

// Side effect: registers every built-in per-record-type parser/view.
import "./records";
