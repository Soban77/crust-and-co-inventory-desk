import jwt from "jsonwebtoken";
import { db } from "./db.js";

const cookieName = "pizza_inventory_session";
const isProduction = process.env.NODE_ENV === "production";

export function setSessionCookie(res, user) {
  const secret = process.env.JWT_SECRET;
  const token = jwt.sign({ sub: String(user.id), role: user.role }, secret, { expiresIn: "8h" });
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/"
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(cookieName, { httpOnly: true, secure: isProduction, sameSite: "strict", path: "/" });
}

export function requireAuth(req, res, next) {
  const token = req.cookies[cookieName];
  if (!token) return res.status(401).json({ error: "Authentication required." });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
  const id = Number(payload.sub);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(401).json({ error: "Session is no longer valid." });
  const user = dbUser(id);
  if (!user) return res.status(401).json({ error: "Session is no longer valid." });
  req.user = user;
  return next();
}

function dbUser(id) {
  return db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(id);
}
