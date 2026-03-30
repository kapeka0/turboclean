import fs from "fs";
import path from "path";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

const isTTY = process.stdout.isTTY ?? false;
const clr = (code: string, text: string) => (isTTY ? `${code}${text}${c.reset}` : text);
const clearLine = () => process.stdout.write("\r\x1b[2K");

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const TARGETS = new Set([".next", "node_modules"]);

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(2)} KB`;
  return `${bytes} B`;
}

function getDirSize(dir: string): number {
  let total = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        total += getDirSize(full);
      } else {
        try {
          total += fs.statSync(full).size;
        } catch {
          // skip locked/inaccessible files
        }
      }
    }
  } catch {
    // skip inaccessible dirs
  }
  return total;
}

async function withSpinner(label: string, fn: () => Promise<void>): Promise<void> {
  if (!isTTY) {
    process.stdout.write(`  ${label}...`);
    await fn();
    console.log(" done");
    return;
  }

  let frame = 0;
  const interval = setInterval(() => {
    const spinner = clr(c.yellow, SPINNER_FRAMES[frame % SPINNER_FRAMES.length]);
    process.stdout.write(`\r\x1b[2K  ${spinner} ${label}`);
    frame++;
  }, 80);

  try {
    await fn();
    clearInterval(interval);
    clearLine();
  } catch (err) {
    clearInterval(interval);
    clearLine();
    throw err;
  }
}

async function findAndDelete(
  rootDir: string,
  excluded: Set<string>
): Promise<{ count: number; totalBytes: number }> {
  let count = 0;
  let totalBytes = 0;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return { count, totalBytes };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const fullPath = path.join(rootDir, entry.name);

    if (excluded.has(entry.name)) {
      console.log(`  ${clr(c.dim, "skipping")} ${clr(c.cyan, fullPath)}`);
      continue;
    }

    if (TARGETS.has(entry.name)) {
      const size = getDirSize(fullPath);
      const label = `${clr(c.dim, "deleting")} ${clr(c.cyan, fullPath)} ${clr(c.yellow, `(${formatSize(size)})`)}`;

      try {
        await withSpinner(label, () => fs.promises.rm(fullPath, { recursive: true, force: true }));
        console.log(`  ${clr(c.green, "✓")} ${label}`);
        count++;
        totalBytes += size;
      } catch (err) {
        console.log(`  ${clr(c.red, "✗")} ${label} ${clr(c.red, `— ${(err as Error).message}`)}`);
      }
    } else {
      const result = await findAndDelete(fullPath, excluded);
      count += result.count;
      totalBytes += result.totalBytes;
    }
  }

  return { count, totalBytes };
}

const args = process.argv.slice(2);
const excludeIdx = args.indexOf("--exclude");
const excluded = new Set(
  excludeIdx !== -1 && args[excludeIdx + 1]
    ? args[excludeIdx + 1].split(",").map((s) => s.trim())
    : []
);
const pathArg = args.find((a) => !a.startsWith("--") && a !== args[excludeIdx + 1]);
const rootDir = pathArg ? path.resolve(pathArg) : process.cwd();

if (!fs.existsSync(rootDir)) {
  console.error(`${clr(c.red, "Error:")} path not found: ${rootDir}`);
  process.exit(1);
}

console.log(`${clr(c.dim, "Scanning:")} ${clr(c.white + c.bold, rootDir)}`);
if (excluded.size > 0) {
  console.log(`${clr(c.dim, "Excluding:")} ${clr(c.yellow, [...excluded].join(", "))}`);
}
console.log();

const { count, totalBytes } = await findAndDelete(rootDir, excluded);
console.log(
  `\n${clr(c.bold, "Done.")} Removed ${clr(c.yellow, String(count))} director${count === 1 ? "y" : "ies"}, freed ${clr(c.green + c.bold, formatSize(totalBytes))}.`
);
