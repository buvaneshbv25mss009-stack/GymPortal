const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const path = require("node:path");
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

app.use("/api/members", membersRouter);

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

  await mongoose.connect(process.env.MONGO_URI);
  await ensureMemberCollection();

  const port = Number(process.env.PORT) || 5000;
  const host = process.env.HOST || "127.0.0.1";

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
