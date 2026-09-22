import {cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
import process from "node:process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const releaseRoot = path.join(root, "release");
const rootPackage = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const [target, tag] = process.argv.slice(2);

if (!new Set(["server", "worker"]).has(target)) {
  throw new Error("Usage: pnpm release:package <server|worker> <tag>");
}
if (!tag || !tag.startsWith("v")) {
  throw new Error("Release tags must start with v");
}

const safeTag = tag.replace(/[^A-Za-z0-9._-]/g, "-");
const packageName = `plainly-${target === "server" ? "server" : "cloudflare-worker"}-${safeTag}`;
const stage = path.join(releaseRoot, packageName);

const required = (relativePath) => {
  const source = path.join(root, relativePath);
  if (!existsSync(source)) throw new Error(`Missing required release input: ${relativePath}`);
  return source;
};

const copy = (relativePath, destination = relativePath) => {
  const targetPath = path.join(stage, destination);
  mkdirSync(path.dirname(targetPath), {recursive: true});
  cpSync(required(relativePath), targetPath, {recursive: true, filter: (source) => !source.endsWith(".test.ts")});
};

const dependencyVersion = (name) => {
  const version = rootPackage.dependencies?.[name];
  if (!version) throw new Error(`Missing root dependency version for ${name}`);
  return version;
};

const writeRuntimePackage = (contents) => {
  writeFileSync(path.join(stage, "package.json"), `${JSON.stringify(contents, null, 2)}\n`);
  const npmArgs = ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"];
  const npmCommand = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : "npm";
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", `npm ${npmArgs.join(" ")}`] : npmArgs;
  const npmCache = path.join(releaseRoot, ".npm-cache");
  const result = spawnSync(npmCommand, commandArgs, {
    cwd: stage,
    env: {...process.env, npm_config_cache: npmCache},
    stdio: "inherit",
  });
  rmSync(npmCache, {recursive: true, force: true});
  if (result.status !== 0) throw new Error(`Could not generate ${target} runtime package-lock.json`);
};

rmSync(stage, {recursive: true, force: true});
mkdirSync(stage, {recursive: true});

if (target === "server") {
  copy("dist-server/server", "server/server");
  copy("dist-server/share", "server/share");
  copy("dist-server/data/store/schema.js", "server/data/store/schema.js");
  copy("dist-server/utils/constant.js", "server/utils/constant.js");
  copy("dist-server/utils/remoteConfigWhitelist.js", "server/utils/remoteConfigWhitelist.js");
  copy("docs");
  copy("config/server.config.json");
  mkdirSync(path.join(stage, "data"), {recursive: true});
  writeFileSync(path.join(stage, "data", ".gitkeep"), "");
  writeRuntimePackage({
    name: "plainly-server-runtime",
    private: true,
    version: rootPackage.version,
    engines: {node: ">=20"},
    scripts: {start: "node server/server/index.js"},
    dependencies: Object.fromEntries(
      [
        "express",
        "cors",
        "body-parser",
        "cookie-parser",
        "jsonwebtoken",
        "better-sqlite3",
        "markdown-it",
      ].map((name) => [name, dependencyVersion(name)]),
    ),
  });
  writeFileSync(
    path.join(stage, "DEPLOY.md"),
    `# Plainly Node server\n\nRequires Node.js 20 or newer. Install runtime dependencies with \`npm ci\` (or \`npm install\`), then start the API:\n\n\`\`\`sh\nnpm ci\nJWT_SECRET='replace-with-a-long-random-secret' npm start\n\`\`\`\n\nSet \`PORT\`, \`API_PREFIX\`, \`DB_FILE\`, \`JWT_SECRET\`, \`ACCESS_TOKEN_TTL_MS\`, \`REFRESH_TOKEN_TTL_MS\`, and \`SHARE_ACCESS_SECRET\` as needed. The default SQLite path is \`data/plainly.db\`.\n\nServe \`docs/\` with Nginx, Caddy, or another static server. Proxy \`/api\` and \`/read\` to this Node process; the Node server does not serve the frontend files itself.\n`,
  );
} else {
  copy("docs");
  copy("worker");
  copy("src/share");
  copy("src/data/store/types.ts");
  copy("src/utils/constant.ts");
  copy("src/utils/remoteConfigWhitelist.ts");
  copy("config/release/wrangler.toml", "wrangler.toml");
  writeRuntimePackage({
    name: "plainly-cloudflare-worker-runtime",
    private: true,
    version: rootPackage.version,
    engines: {node: ">=20"},
    scripts: {deploy: "npx --yes wrangler deploy", "deploy:dry-run": "npx --yes wrangler deploy --dry-run"},
    dependencies: {"markdown-it": dependencyVersion("markdown-it")},
  });
  writeFileSync(
    path.join(stage, "DEPLOY.md"),
    `# Plainly Cloudflare Worker\n\nRequires Node.js 20 or newer. Edit \`wrangler.toml\` to set a unique worker \`name\` and your D1 \`database_name\` and \`database_id\`; optionally add your account and route configuration. The template intentionally contains no production account, route, database ID, or secret.\n\n\`\`\`sh\nnpm ci\nnpx wrangler secret put JWT_SECRET\nnpm run deploy\n\`\`\`\n\n\`JWT_SECRET\` must be stored as a Cloudflare secret, not in \`wrangler.toml\`. The Worker serves \`docs/\` through the \`ASSETS\` binding and handles \`/api\` and \`/read\` itself.\n`,
  );
}

const manifest = {
  target,
  tag,
  stageName: packageName,
  archiveName: `${packageName}.zip`,
};
writeFileSync(path.join(releaseRoot, "package-result.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest));
