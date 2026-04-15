import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(scriptDir, "..");
const apiDir = resolve(webDir, "..", "api");
const repoRoot = resolve(apiDir, "..", "..");
const outputFile = resolve(webDir, "src", "types", "api.generated.ts");

const execOpts = { cwd: apiDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 };

function apiVenvPython() {
  const win = process.platform === "win32";
  const rel = win ? join("Scripts", "python.exe") : join("bin", "python3");
  const p = join(apiDir, ".venv", rel);
  return existsSync(p) ? p : null;
}

function buildOpenApiJson() {
  const argv = ["-m", "app.export_openapi"];

  try {
    return execFileSync("uv", ["run", "python", ...argv], execOpts);
  } catch {
    /* continue */
  }

  const venvPy = apiVenvPython();
  if (venvPy) {
    try {
      return execFileSync(venvPy, argv, execOpts);
    } catch {
      /* continue */
    }
  }

  try {
    return execFileSync(
      "docker",
      [
        "compose",
        "run",
        "-T",
        "--rm",
        "--no-deps",
        "api",
        "sh",
        "-ec",
        "uv run python -m app.export_openapi",
      ],
      { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
  } catch {
    /* continue */
  }

  return execFileSync("python", argv, execOpts);
}

function generateTypes(tempOpenApiPath, targetFile) {
  const q = (p) => (p.includes(" ") ? `"${p}"` : p);
  execSync(`npx --yes openapi-typescript ${q(tempOpenApiPath)} -o ${q(targetFile)}`, {
    cwd: webDir,
    stdio: "inherit",
    shell: true,
  });
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
