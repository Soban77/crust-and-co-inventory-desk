import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pizza-inventory-test-"));
process.env.DATABASE_PATH = path.join(directory, "test.sqlite");
process.env.JWT_SECRET = "test-secret-with-more-than-thirty-two-characters";
process.env.NODE_ENV = "test";

const { db } = await import("../src/db.js");
const { default: app } = await import("../src/app.js");
let server;
let baseUrl;
let cookie;
let itemId;

before(async () => {
  const hash = bcrypt.hashSync("test-password", 4);
  db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)").run("Test Manager", "manager@example.test", hash, "manager");
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "manager@example.test", password: "test-password" })
  });
  assert.equal(response.status, 200);
  cookie = response.headers.get("set-cookie").split(";")[0];
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

async function request(endpoint, options = {}) {
  return fetch(`${baseUrl}/api${endpoint}`, {
    ...options,
    headers: { cookie, ...(options.body ? { "content-type": "application/json" } : {}), ...options.headers }
  });
}

test("inventory routes require authentication", async () => {
  const response = await fetch(`${baseUrl}/api/items`);
  assert.equal(response.status, 401);
});

test("stock movements update quantity atomically and reject negative stock", async () => {
  const create = await request("/items", {
    method: "POST",
    body: JSON.stringify({ name: "Test mozzarella", category: "Cheese", unit: "kg", currentQuantity: 2, minimumStockLevel: 1 })
  });
  assert.equal(create.status, 201);
  itemId = (await create.json()).item.id;

  const search = await request("/items?search=Test%20mozzarella&category=Cheese&status=active");
  assert.equal((await search.json()).items[0].id, itemId);

  const rejected = await request(`/items/${itemId}/transactions`, {
    method: "POST",
    body: JSON.stringify({ type: "STOCK_OUT", quantity: 3 })
  });
  assert.equal(rejected.status, 409);

  const afterRejected = await request(`/items/${itemId}`);
  assert.equal((await afterRejected.json()).item.quantity_available, 2);

  const received = await request(`/items/${itemId}/transactions`, {
    method: "POST",
    body: JSON.stringify({ type: "STOCK_IN", quantity: 2.5, remarks: "Supplier delivery" })
  });
  assert.equal(received.status, 201);
  const item = (await received.json()).item;
  assert.equal(item.quantity_available, 4.5);

  const adjustment = await request(`/items/${itemId}/transactions`, {
    method: "POST",
    body: JSON.stringify({ type: "ADJUSTMENT", quantity: -0.5, remarks: "Waste count" })
  });
  assert.equal(adjustment.status, 201);
  assert.equal((await adjustment.json()).item.quantity_available, 4);

  const history = await request(`/items/${itemId}`);
  assert.equal((await history.json()).transactions.length, 3);
});

test("invalid item data is rejected without creating a row", async () => {
  const response = await request("/items", {
    method: "POST",
    body: JSON.stringify({ name: "x", category: "Cheese", unit: "kg", currentQuantity: -1, minimumStockLevel: 1 })
  });
  assert.equal(response.status, 400);
});
