#!/usr/bin/env node
/**
 * Single entry point: `npm run dev` from monto-ai/ boots the backend
 * (FastAPI/uvicorn) and the frontend (Next.js child app) together, in one
 * terminal, with output prefixed per service.
 *
 * Bootstraps whatever a fresh clone is missing (backend venv + deps,
 * frontend node_modules, .env files copied from .env.example) so it works
 * the same on a freshly cloned Raspberry Pi as it does on an existing dev
 * machine. Real API keys (GROQ_API_KEY etc.) still have to be filled in by
 * hand — those can't be generated.
 */
const { spawnSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BACKEND_DIR = path.join(ROOT, "backend");
const FRONTEND_DIR = path.join(ROOT, "frontend");
const IS_WIN = process.platform === "win32";

const VENV_PYTHON = path.join(BACKEND_DIR, "venv", IS_WIN ? "Scripts\\python.exe" : "bin/python");

function log(tag, msg) {
  console.log(`[${tag}] ${msg}`);
}

function ensureEnvFile(dir, label) {
  const envPath = path.join(dir, ".env");
  const examplePath = path.join(dir, ".env.example");
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    log(label, `.env missing — created from .env.example. Fill in real API keys before this will fully work.`);
  }
}

function ensureBackendVenv() {
  if (fs.existsSync(VENV_PYTHON)) return;
  log("backend", "venv not found — creating one (this happens once)...");
  const pythonCmd = IS_WIN ? "python" : "python3";
  const create = spawnSync(pythonCmd, ["-m", "venv", "venv"], { cwd: BACKEND_DIR, stdio: "inherit" });
  if (create.status !== 0) {
    console.error(`[backend] Could not create a venv. On Debian/Raspberry Pi OS you may need: sudo apt install python3-venv`);
    process.exit(1);
  }
  log("backend", "installing Python dependencies (this happens once)...");
  const install = spawnSync(VENV_PYTHON, ["-m", "pip", "install", "-r", "requirements.txt"], {
    cwd: BACKEND_DIR,
    stdio: "inherit",
  });
  if (install.status !== 0) {
    console.error("[backend] pip install failed — see output above.");
    process.exit(1);
  }
}

function ensureFrontendDeps() {
  if (fs.existsSync(path.join(FRONTEND_DIR, "node_modules"))) return;
  log("frontend", "node_modules not found — running npm install (this happens once)...");
  const install = spawnSync("npm", ["install"], { cwd: FRONTEND_DIR, stdio: "inherit", shell: IS_WIN });
  if (install.status !== 0) {
    console.error("[frontend] npm install failed — see output above.");
    process.exit(1);
  }
}

function prefixedSpawn(tag, command, args, cwd) {
  const cmd = IS_WIN && command.includes(" ") ? `"${command}"` : command;
  const child = spawn(cmd, args, { cwd, shell: IS_WIN });
  const pipe = (stream, out) => {
    stream.on("data", (chunk) => {
      chunk
        .toString()
        .split("\n")
        .filter(Boolean)
        .forEach((line) => out.write(`[${tag}] ${line}\n`));
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  return child;
}

ensureEnvFile(BACKEND_DIR, "backend");
ensureEnvFile(FRONTEND_DIR, "frontend");
ensureBackendVenv();
ensureFrontendDeps();

log("dev-all", "starting backend (:8000) and frontend (:3000) together — Ctrl+C stops both");

const backend = prefixedSpawn(
  "backend",
  VENV_PYTHON,
  ["-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
  BACKEND_DIR
);
const frontend = prefixedSpawn("frontend", "npm", ["run", "dev"], FRONTEND_DIR);

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  log("dev-all", "stopping backend and frontend...");
  backend.kill();
  frontend.kill();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
backend.on("exit", (code) => {
  if (!shuttingDown) log("backend", `exited (code ${code}) — stopping frontend too`);
  if (!shuttingDown) shutdown();
});
frontend.on("exit", (code) => {
  if (!shuttingDown) log("frontend", `exited (code ${code}) — stopping backend too`);
  if (!shuttingDown) shutdown();
});
