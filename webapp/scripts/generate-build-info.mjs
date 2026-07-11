import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

let gitHash = "unknown";
try {
  gitHash = execSync("git rev-parse --short HEAD", {
    cwd: join(root, ".."),
    encoding: "utf8",
  }).trim();
} catch {
  // not a git repo or git unavailable
}

const info = {
  version: pkg.version,
  gitHash,
  buildTime: new Date().toISOString(),
};

writeFileSync(join(root, "src/build-info.json"), `${JSON.stringify(info, null, 2)}\n`);
