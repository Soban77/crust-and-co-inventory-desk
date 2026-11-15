import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./db.js";

const email = process.env.SEED_ADMIN_EMAIL || "admin@pizzashop.local";
const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
const staffPassword = process.env.SEED_STAFF_PASSWORD || "KitchenStaff123!";
if (password.length < 12) throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters.");
if (staffPassword.length < 12) throw new Error("SEED_STAFF_PASSWORD must be at least 12 characters.");

const seed = db.transaction(() => {
  const hash = bcrypt.hashSync(password, 12);
  db.prepare(`
    INSERT INTO users (name, email, password_hash, role) VALUES ('Restaurant Manager', ?, ?, 'manager')
    ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, name = excluded.name, role = 'manager'
  `).run(email, hash);
  const manager = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  db.prepare(`
    INSERT INTO users (name, email, password_hash, role) VALUES ('Kitchen Staff', 'staff@pizzashop.local', ?, 'staff')
    ON CONFLICT(email) DO NOTHING
  `).run(bcrypt.hashSync(staffPassword, 12));
  const count = db.prepare("SELECT COUNT(*) AS count FROM inventory_items").get().count;
  if (count) return manager.id;

  const rows = [
    ["Mozzarella Cheese", "Cheese", "kg", 8.5, 10, "Dairy Fresh Co.", "Low-moisture whole milk mozzarella"],
    ["Pizza Dough Balls", "Dough", "pcs", 42, 30, "House-made", "Cold-fermented  dough, 280 g each"],
    ["Pepperoni Slices", "Toppings", "kg", 8.2, 5, "Italian Foods Ltd.", "Keep refrigerated"],
    ["Marinara Sauce", "Sauces", "liters", 6, 4, "House-made", "Prepared daily"],
    ['12" Pizza Boxes', "Packaging", "pcs", 18, 25, "PackRight", "Flat-packed kraft boxes"],
    ["Fresh Basil", "Toppings", "bunches", 12, 6, "Green Valley Produce", "Store in cool area"],
    ["Olive Oil", "Sauces", "liters", 4.5, 3, "Mediterranean Pantry", null],
    ["Sparkling Water", "Beverages", "bottles", 36, 24, "Local Beverage Co.", null],
    ["Parmesan Cheese", "Cheese", "kg", 4.2, 3, "Dairy Fresh Co.", "Grated to order"],
    ["Gloves - Medium", "Packaging", "boxes", 7, 5, "SafeServe Supplies", null]
  ];
  const itemInsert = db.prepare(`
    INSERT INTO inventory_items (name, category, unit, quantity_available, minimum_stock_level, supplier, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const transactionInsert = db.prepare(`
    INSERT INTO stock_transactions (item_id, type, quantity_changed, recorded_by, remarks)
    VALUES (?, ?, ?, ?, ?)
  `);
  rows.forEach((row, index) => {
    const result = itemInsert.run(...row);
    const sampleUsage = index === 2 ? 1.8 : index === 4 ? 7 : 0;
    transactionInsert.run(result.lastInsertRowid, "STOCK_IN", row[3] + sampleUsage, manager.id, "Opening stock");
    if (index === 2) transactionInsert.run(result.lastInsertRowid, "STOCK_OUT", -1.8, manager.id, "Prep for evening service");
    if (index === 4) transactionInsert.run(result.lastInsertRowid, "STOCK_OUT", -7, manager.id, "Used for today's orders");
  });
  return manager.id;
});

seed();
console.log(`Seed complete. Manager account: ${email}`);
console.log("Change the seeded password before using this system in a live environment.");
db.close();
