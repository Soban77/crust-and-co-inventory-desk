import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";
import { clearSessionCookie, requireAuth, setSessionCookie } from "./auth.js";
import { itemSchema, loginSchema, transactionSchema } from "./validation.js";

const app = express();
const here = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false }));
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Try again in 15 minutes." }
});

function validate(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const error = new Error(result.error.issues.map((issue) => issue.message).join(" "));
    error.status = 400;
    throw error;
  }
  return result.data;
}

function itemWithStatus(row) {
  return { ...row, active: Boolean(row.active), lowStock: row.active === 1 && row.quantity_available <= row.minimum_stock_level };
}

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.post("/api/auth/login", loginLimiter, (req, res, next) => {
  try {
    const { email, password } = validate(loginSchema, req.body);
    const user = db.prepare("SELECT id, name, email, password_hash, role FROM users WHERE email = ? COLLATE NOCASE").get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    setSessionCookie(res, user);
    return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));

app.use("/api", requireAuth);

app.get("/api/dashboard", (_req, res) => {
  const summary = db.prepare(`
    SELECT COUNT(*) AS totalItems,
      SUM(CASE WHEN quantity_available <= minimum_stock_level THEN 1 ELSE 0 END) AS lowStockItems
    FROM inventory_items WHERE active = 1
  `).get();
  const lowStock = db.prepare(`
    SELECT * FROM inventory_items WHERE active = 1 AND quantity_available <= minimum_stock_level
    ORDER BY (minimum_stock_level - quantity_available) DESC, name LIMIT 8
  `).all().map(itemWithStatus);
  const recentActivity = db.prepare(`
    SELECT t.id, t.item_id AS itemId, i.name AS itemName, i.unit, t.type,
      t.quantity_changed AS quantityChanged, t.remarks, t.created_at AS createdAt,
      u.name AS recordedBy
    FROM stock_transactions t
    JOIN inventory_items i ON i.id = t.item_id
    JOIN users u ON u.id = t.recorded_by
    ORDER BY t.created_at DESC, t.id DESC LIMIT 8
  `).all();
  res.json({ summary: { totalItems: summary.totalItems, lowStockItems: summary.lowStockItems || 0 }, lowStock, recentActivity });
});

app.get("/api/items", (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 120) : "";
  const category = typeof req.query.category === "string" ? req.query.category.slice(0, 60) : "";
  const status = req.query.status === "all" ? "all" : req.query.status === "low" ? "low" : "active";
  const sortColumns = { name: "name COLLATE NOCASE", category: "category COLLATE NOCASE", stock: "(quantity_available <= minimum_stock_level) DESC, name COLLATE NOCASE" };
  const sort = sortColumns[req.query.sort] || sortColumns.name;
  const conditions = [];
  const parameters = [];
  if (status === "active") conditions.push("active = 1");
  if (status === "low") conditions.push("active = 1 AND quantity_available <= minimum_stock_level");
  if (search) {
    conditions.push("(name LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\' OR supplier LIKE ? ESCAPE '\\')");
    const escaped = search.replace(/[\\%_]/g, "\\$&");
    parameters.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`);
  }
  if (category) {
    conditions.push("category = ?");
    parameters.push(category);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const items = db.prepare(`SELECT * FROM inventory_items ${where} ORDER BY ${sort}`).all(...parameters).map(itemWithStatus);
  const categories = db.prepare("SELECT DISTINCT category FROM inventory_items WHERE active = 1 ORDER BY category COLLATE NOCASE").all().map((row) => row.category);
  res.json({ items, categories });
});

app.get("/api/items/:id", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid item ID." });
    const item = db.prepare("SELECT * FROM inventory_items WHERE id = ?").get(id);
    if (!item) return res.status(404).json({ error: "Item not found." });
    const transactions = db.prepare(`
      SELECT t.id, t.type, t.quantity_changed AS quantityChanged, t.remarks,
        t.created_at AS createdAt, u.name AS recordedBy
      FROM stock_transactions t JOIN users u ON u.id = t.recorded_by
      WHERE t.item_id = ? ORDER BY t.created_at DESC, t.id DESC
    `).all(id);
    res.json({ item: itemWithStatus(item), transactions });
  } catch (error) {
    next(error);
  }
});

app.post("/api/items", (req, res, next) => {
  try {
    const input = validate(itemSchema, req.body);
    const initialQuantity = input.currentQuantity || 0;
    const createItem = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO inventory_items (name, category, unit, quantity_available, minimum_stock_level, supplier, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(input.name, input.category, input.unit, initialQuantity, input.minimumStockLevel, input.supplier, input.notes);
      if (initialQuantity > 0) {
        db.prepare("INSERT INTO stock_transactions (item_id, type, quantity_changed, recorded_by, remarks) VALUES (?, 'STOCK_IN', ?, ?, 'Initial stock')").run(result.lastInsertRowid, initialQuantity, req.user.id);
      }
      return db.prepare("SELECT * FROM inventory_items WHERE id = ?").get(result.lastInsertRowid);
    });
    res.status(201).json({ item: itemWithStatus(createItem()) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/items/:id", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid item ID." });
    const input = validate(itemSchema.partial().extend({ active: z.boolean().optional() }), req.body);
    const existing = db.prepare("SELECT * FROM inventory_items WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Item not found." });
    const fields = { ...input };
    if (Object.prototype.hasOwnProperty.call(req.body, "active")) {
      if (typeof req.body.active !== "boolean") return res.status(400).json({ error: "Active must be a boolean." });
      fields.active = req.body.active ? 1 : 0;
    }
    if (Object.prototype.hasOwnProperty.call(fields, "currentQuantity")) {
      return res.status(400).json({ error: "Use a stock transaction to change the current quantity." });
    }
    const columnMap = { name: "name", category: "category", unit: "unit", minimumStockLevel: "minimum_stock_level", supplier: "supplier", notes: "notes", active: "active" };
    const updates = Object.entries(fields).filter(([key]) => columnMap[key]);
    if (updates.length) {
      const setClause = updates.map(([key]) => `${columnMap[key]} = ?`).join(", ");
      db.prepare(`UPDATE inventory_items SET ${setClause}, updated_at = datetime('now') WHERE id = ?`).run(...updates.map(([, value]) => value), id);
    }
    const item = db.prepare("SELECT * FROM inventory_items WHERE id = ?").get(id);
    res.json({ item: itemWithStatus(item) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/items/:id/transactions", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid item ID." });
    const input = validate(transactionSchema, req.body);
    const delta = input.type === "STOCK_IN" ? input.quantity : input.type === "STOCK_OUT" ? -input.quantity : input.quantity;
    const saveTransaction = db.transaction(() => {
      const item = db.prepare("SELECT * FROM inventory_items WHERE id = ? AND active = 1").get(id);
      if (!item) {
        const error = new Error("Active item not found.");
        error.status = 404;
        throw error;
      }
      const update = db.prepare("UPDATE inventory_items SET quantity_available = quantity_available + ?, updated_at = datetime('now') WHERE id = ? AND quantity_available + ? >= 0").run(delta, id, delta);
      if (update.changes !== 1) {
        const error = new Error("This transaction would reduce stock below zero.");
        error.status = 409;
        throw error;
      }
      const result = db.prepare("INSERT INTO stock_transactions (item_id, type, quantity_changed, recorded_by, remarks) VALUES (?, ?, ?, ?, ?)").run(id, input.type, delta, req.user.id, input.remarks);
      return {
        transaction: db.prepare("SELECT id, type, quantity_changed AS quantityChanged, remarks, created_at AS createdAt FROM stock_transactions WHERE id = ?").get(result.lastInsertRowid),
        item: db.prepare("SELECT * FROM inventory_items WHERE id = ?").get(id)
      };
    });
    res.status(201).json(saveTransaction());
  } catch (error) {
    next(error);
  }
});

app.delete("/api/items/:id", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid item ID." });
    const result = db.prepare("UPDATE inventory_items SET active = 0, updated_at = datetime('now') WHERE id = ? AND active = 1").run(id);
    if (!result.changes) return res.status(404).json({ error: "Active item not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(here, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

app.use((error, _req, res, _next) => {
  if (res.headersSent) return;
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status === 500 ? "An unexpected server error occurred." : error.message });
});

export default app;
