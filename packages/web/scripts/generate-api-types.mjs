import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(scriptDir, "..");
const apiDir = resolve(webDir, "..", "api");
const outputFile = resolve(webDir, "src", "types", "api.generated.ts");

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

mkdirSync(dirname(outputFile), { recursive: true });

const tempDir = mkdtempSync(join(tmpdir(), "aeogeo-openapi-"));
const tempOpenApiPath = join(tempDir, "openapi.json");

try {
  writeFileSync(tempOpenApiPath, buildOpenApiJson());
  generateTypes(tempOpenApiPath, outputFile);
  const generated = readFileSync(outputFile, "utf8");
  if (!generated.includes("BrandResponse")) {
    throw new Error("Generated types are missing BrandResponse");
  }
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}
