## 1. Foundation

- [x] 1.1 Add `webapp/src/rr/types.ts` defining the shared `RrParser<T>`, `RrFieldMeta` (`key`, `label`, `explain: {minimal, standard, detailed}`), and `RrViewProps<T>` shapes used by every per-type module.
- [x] 1.2 Add `webapp/src/rr/registry.ts` mapping upper-cased `record_type` to a `{ parse, fields, View }` entry; export a lookup function that returns `undefined` for unregistered types.
- [x] 1.3 Add shared presentational primitives (`webapp/src/rr/FieldList.tsx`, `LabeledField.tsx`) used by all per-type views to render a list of labeled fields with detail-level-aware explanation text.
- [x] 1.4 Add `webapp/src/rr/GenericView.tsx` (or reuse the current raw `<ul>` rendering) as the fallback view for unregistered/unparsed record types.
- [x] 1.5 Add `webapp/src/rrViewPrefsStore.ts` (modeled on `displayPrefsStore.ts`) persisting the default raw/parsed mode and the explanation detail level (minimal/standard/detailed) in the IndexedDB `prefs` store, with `get`/`set`/`apply`/`init` functions.

## 2. Tokenizing helpers

- [x] 2.1 Add shared string-tokenizing helpers in `webapp/src/rr/tokenize.ts` for: whitespace-splitting respecting double-quoted character-strings (TXT/HINFO/CAA/NAPTR), stripping hickory's parenthesis line-continuation wrapping (DNSKEY/RRSIG/CERT/KEY/SIG), and fixed-arity positional field splitting (SOA/SRV/MX/CAA/SSHFP/TLSA/DS/NSEC3).
- [x] 2.2 Unit test the tokenizing helpers against representative raw strings for each of the above shapes, including malformed/unexpected input returning `null` rather than throwing.

## 3. Address & common record parsers/views

- [x] 3.1 Implement parser + field metadata + view for A, AAAA (address).
- [x] 3.2 Implement parser + field metadata + view for CNAME, NS, PTR, ANAME (single target-name records).
- [x] 3.3 Implement parser + field metadata + view for MX (`preference`, `exchange`).
- [x] 3.4 Implement parser + field metadata + view for TXT (one or more quoted character-strings).
- [x] 3.5 Implement parser + field metadata + view for SOA (`mname`, `rname`, `serial`, `refresh`, `retry`, `expire`, `minimum`).
- [x] 3.6 Register all of the above in `rr/registry.ts` and write parser unit tests using the example strings already in `recordTypeHelp.ts` as fixtures.

## 4. Service record parsers/views

- [x] 4.1 Implement parser + field metadata + view for SRV (`priority`, `weight`, `port`, `target`).
- [x] 4.2 Implement parser + field metadata + view for HTTPS/SVCB (`priority`, `target`, key-value params such as `alpn`, `ipv4hint`, `ech`).
- [x] 4.3 Implement parser + field metadata + view for NAPTR (`order`, `preference`, `flags`, `service`, `regexp`, `replacement`).
- [x] 4.4 Register the above in `rr/registry.ts` and write parser unit tests.

## 5. Security record parsers/views

- [x] 5.1 Implement parser + field metadata + view for CAA (`flag`, `tag`, `value`).
- [x] 5.2 Implement parser + field metadata + view for TLSA (`usage`, `selector`, `matchingType`, `certData`).
- [x] 5.3 Implement parser + field metadata + view for SSHFP (`algorithm`, `fpType`, `fingerprint`).
- [x] 5.4 Implement parser + field metadata + view for CERT, OPENPGPKEY, SMIMEA (type/key-material fields per RFC, exposing binary material as a labeled base64/hex blob, not decoded further).
- [x] 5.5 Register the above in `rr/registry.ts` and write parser unit tests.

## 6. DNSSEC record parsers/views

- [x] 6.1 Implement parser + field metadata + view for DNSKEY, CDNSKEY, KEY (`flags`, `protocol`, `algorithm`, `publicKey`).
- [x] 6.2 Implement parser + field metadata + view for DS, CDS (`keyTag`, `algorithm`, `digestType`, `digest`).
- [x] 6.3 Implement parser + field metadata + view for RRSIG, SIG (`typeCovered`, `algorithm`, `labels`, `originalTtl`, `expiration`, `inception`, `keyTag`, `signerName`, `signature`).
- [x] 6.4 Implement parser + field metadata + view for NSEC (`nextDomainName`, `typeBitmaps`), NSEC3 (`hashAlgorithm`, `flags`, `iterations`, `salt`, `nextHashedOwnerName`, `typeBitmaps`), NSEC3PARAM (`hashAlgorithm`, `flags`, `iterations`, `salt`).
- [x] 6.5 Implement parser + field metadata + view for CSYNC (`serial`, `flags`, `typeBitmaps`).
- [x] 6.6 Register the above in `rr/registry.ts` and write parser unit tests.

## 7. Other record parsers/views

- [x] 7.1 Implement parser + field metadata + view for HINFO (`cpu`, `os`).
- [x] 7.2 Register the above in `rr/registry.ts` and write parser unit tests.

## 8. Results view integration

- [x] 8.1 Update `formatRecordResult.ts` / `RecordResultCard.tsx` to look up each record's parser/view via the registry, render the parsed view by default, and fall back to the existing raw `<ul>` rendering when unregistered or unparsed.
- [x] 8.2 Add a per-record raw/parsed toggle control to `RecordResultCard.tsx`, defaulting to the persisted preference from `rrViewPrefsStore.ts`.
- [x] 8.3 Wire the explanation detail level from `rrViewPrefsStore.ts` into the rendered views, with a UI control to change it (e.g. in the hamburger menu Settings panel alongside the existing help example wrap preference).

## 9. Help modal integration

- [x] 9.1 Update `RecordTypeHelpModal.tsx` to extract the RDATA portion of `recordTypeHelp.ts`'s `example` string and run it through the same registry lookup used by results.
- [x] 9.2 Render the parsed view (with the same raw/parsed toggle and detail-level preference) in the help modal, falling back to the existing raw example text when the type is unregistered or the example fails to parse.

## 10. Tests and verification

- [x] 10.1 Add/extend unit tests covering registry fallback behavior (unregistered type, parser returning `null`) for both results and help modal integration points.
- [x] 10.2 Add unit tests for `rrViewPrefsStore.ts` persistence (default values, round-trip get/set) following the pattern of existing `displayPrefsStore` tests if present.
- [x] 10.3 Run `yarn typecheck`, `yarn test`, and `yarn build` in `webapp/` and confirm a clean pass.
- [x] 10.4 Manually verify in the running app: a lookup returning multiple record types shows parsed views by default, the raw toggle round-trips correctly, and the help modal for at least one DNSSEC and one non-DNSSEC type shows the same parsed view as live results.
