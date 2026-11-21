const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const path = require("node:path");
const crypto = require("node:crypto");
const Member = require("./models/Member");
const membersRouter = require("./routes/members");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "10kb" }));

const adminId = process.env.ADMIN_ID || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "admin";
const sessions = new Map();

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requireAdmin(req, res, next) {
  const authorization = req.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!sessions.has(token)) {
    return res.status(401).json({ error: "Admin login required." });
  }

  return next();
}

app.post("/api/auth/login", (req, res) => {
  const id = req.body?.id;
  const password = req.body?.password;

  if (!safeEqual(id, adminId) || !safeEqual(password, adminPassword)) {
    return res.status(401).json({ error: "Invalid admin ID or password." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { id: adminId, createdAt: Date.now() });
  return res.json({ token, admin: { id: adminId } });
});

app.post("/api/auth/logout", requireAdmin, (req, res) => {
  const token = (req.get("authorization") || "").slice(7);
  sessions.delete(token);
  return res.status(204).end();
});

app.get("/api/auth/session", requireAdmin, (req, res) => {
  res.json({ admin: { id: adminId } });
});

app.get("/", (req, res) => {
  res.json({ message: "GymPortal API is running." });
});

app.get("/api/health", (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? "ok" : "unavailable",
    database: connected ? "connected" : "disconnected"
  });
});

app.use("/api/members", requireAdmin, membersRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body contains invalid JSON." });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }

  if (error.code === 11000) {
    return res.status(409).json({ error: "A member with this email already exists." });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      error: "Member validation failed.",
      fields: Object.keys(error.errors)
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({ error: "Invalid member data." });
  }

  console.error("API error:", error);
  return res.status(500).json({ error: "Internal server error." });
});

async function ensureMemberCollection() {
  const collectionExists = await mongoose.connection.db
    .listCollections({ name: Member.collection.name }, { nameOnly: true })
    .hasNext();

  if (!collectionExists) {
    await Member.createCollection();
  }

  await Member.init();
}

async function startServer() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required. Set it in backend/.env.");
  }

  const port = Number(process.env.PORT) || 5000;
  const host = process.env.HOST || "127.0.0.1";

  try {
    await mongoose.connect(process.env.MONGO_URI);
    await ensureMemberCollection();
  } catch (error) {
    console.warn(`MongoDB unavailable; member data will use temporary memory: ${error.message}`);
  }

  return app.listen(port, host, () => {
    console.log(`GymPortal API listening on http://${host}:${port}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Backend startup failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, startServer };
