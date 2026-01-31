import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import {NodeDataStore} from "./NodeDataStore";
import {UpdateDocumentMetaInput} from "../data/store";

type ServerConfig = {
  port?: number;
  apiPrefix?: string;
  dbFile?: string;
};

const loadConfig = (): ServerConfig => {
  const configPath = path.resolve(process.cwd(), "config", "server.config.json");
  if (!fs.existsSync(configPath)) return {};
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw) as ServerConfig;
  } catch (e) {
    console.warn("Failed to read config/server.config.json:", e);
    return {};
  }
};

const cfg = loadConfig();
const PORT = process.env.PORT ? Number(process.env.PORT) : cfg.port ?? 8788;
const API_PREFIX = process.env.API_PREFIX || cfg.apiPrefix || "/api";
const DB_FILE = process.env.DB_FILE || cfg.dbFile || "data/plainly.db";

async function main() {
  const store = new NodeDataStore(DB_FILE);
  await store.init();

  const app = express();
  app.use(cors());
  app.use(bodyParser.json({limit: "10mb"}));

  const router = express.Router();

  // categories
  router.get("/categories", async (_req, res) => {
    res.json(await store.listCategories());
  });
  router.get("/categories/count", async (_req, res) => {
    res.json(await store.listCategoriesWithCount());
  });
  router.post("/categories", async (req, res) => {
    const {name} = req.body || {};
    if (!name) return res.status(400).json({error: "name required"});
    res.json(await store.createCategory(name));
  });
  router.patch("/categories/:id", async (req, res) => {
    await store.renameCategory(Number(req.params.id), req.body?.name);
    res.json({});
  });
  router.delete("/categories/:id", async (req, res) => {
    const reassignTo = req.query.reassignTo ? Number(req.query.reassignTo) : undefined;
    await store.deleteCategory(Number(req.params.id), {reassignTo});
    res.json({});
  });

  // documents
  router.get("/documents", async (req, res) => {
    const offset = Number(req.query.offset || 0);
    const limit = Number(req.query.limit || 20);
    res.json(await store.listDocumentsPage(offset, limit));
  });
  router.get("/documents/all", async (_req, res) => {
    res.json(await store.listAllDocuments());
  });
  router.get("/documents/:id/meta", async (req, res) => {
    res.json(await store.getDocumentMeta(Number(req.params.id)));
  });
  router.patch("/documents/:id/meta", async (req, res) => {
    await store.updateDocumentMeta(Number(req.params.id), req.body as UpdateDocumentMetaInput);
    res.json({});
  });
  router.post("/documents", async (req, res) => {
    const {meta, content} = req.body || {};
    if (!meta || typeof content !== "string") return res.status(400).json({error: "invalid payload"});
    const id = await store.createDocument(meta, content);
    res.json(id);
  });
  router.get("/documents/:id/content", async (req, res) => {
    res.json(await store.getDocumentContent(Number(req.params.id)));
  });
  router.delete("/documents/:id", async (req, res) => {
    await store.deleteDocument(Number(req.params.id));
    res.json({});
  });
  router.post("/documents/:id/charcount", async (req, res) => {
    const meta = req.body;
    res.json(await store.ensureDocumentCharCount(meta));
  });

  // config
  router.get("/config", async (req, res) => {
    const prefix = req.query.prefix ? String(req.query.prefix) : undefined;
    res.json(await store.listConfigKeys(prefix));
  });
  router.get("/config/:key", async (req, res) => {
    const fallback = req.query.fallback ? JSON.parse(String(req.query.fallback)) : undefined;
    res.json(await store.getConfig(req.params.key, fallback));
  });
  router.put("/config/:key", async (req, res) => {
    await store.setConfig(req.params.key, req.body?.value);
    res.json({});
  });
  router.delete("/config/:key", async (req, res) => {
    await store.removeConfig(req.params.key);
    res.json({});
  });

  app.use(API_PREFIX, router);

  const server = app.listen(PORT, () => {
    console.log(`DataStore API listening on http://localhost:${PORT}${API_PREFIX}`);
  });
  server.on("error", (err) => {
    console.error("DataStore API failed to start:", err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
