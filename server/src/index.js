import "dotenv/config";
import app from "./app.js";
import { db } from "./db.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set to at least 32 characters.");
}

const port = Number(process.env.PORT) || 4000;
const server = app.listen(port, () => console.log(`Inventory API listening on http://localhost:${port}`));

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
