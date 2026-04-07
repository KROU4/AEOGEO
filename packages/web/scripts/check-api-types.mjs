import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(scriptDir, "..");
const apiDir = resolve(webDir, "..", "api");
const currentTypes = resolve(webDir, "src", "types", "api.generated.ts");

function buildOpenApiJson() {
  return execFileSync("uv", ["run", "python", "-m", "app.export_openapi"], {
    cwd: apiDir,
    encoding: "utf8",
  });
}

function generateTypes(tempOpenApiPath, targetFile) {
  execFileSync(
    "bunx",
    ["openapi-typescript", tempOpenApiPath, "-o", targetFile],
    {
      cwd: webDir,
      stdio: "inherit",
    },
  );
}

const tempDir = mkdtempSync(join(tmpdir(), "aeogeo-openapi-check-"));
const tempOpenApiPath = join(tempDir, "openapi.json");
const tempTypesPath = join(tempDir, "api.generated.ts");

try {
  writeFileSync(tempOpenApiPath, buildOpenApiJson());
  generateTypes(tempOpenApiPath, tempTypesPath);

  const expected = readFileSync(currentTypes, "utf8");
  const actual = readFileSync(tempTypesPath, "utf8");

  if (expected !== actual) {
    process.stderr.write(
      "api.generated.ts is stale. Run `bun run generate:types` in packages/web.\n",
    );
    process.exit(1);
  }
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}
