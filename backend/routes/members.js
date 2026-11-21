const express = require("express");
const mongoose = require("mongoose");
const Member = require("../models/Member");

const router = express.Router();
const allowedFields = new Set(["name", "email", "membershipType"]);
const memoryMembers = [];

function newMemoryId() {
  return Array.from({ length: 24 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

function validateMemoryMember(body) {
  if (!body.name || body.name.length < 2 || body.name.length > 100) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email || "")) return false;
  if (!body.membershipType || body.membershipType.length > 50) return false;
  return true;
}

function getMemberPayload(body, res, allowEmpty = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    res.status(400).json({ error: "Request body must be a JSON object." });
    return null;
  }

  const unknownFields = Object.keys(body).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    res.status(400).json({
      error: "Request contains unsupported fields.",
      fields: unknownFields
    });
    return null;
  }

  if (!allowEmpty && Object.keys(body).length === 0) {
    res.status(400).json({ error: "At least one member field is required." });
    return null;
  }

  return body;
}

function isValidMemberId(id) {
  return mongoose.isObjectIdOrHexString(id);
}

router.get("/", async (req, res) => {
  if (!isDatabaseConnected()) {
    return res.json([...memoryMembers].reverse());
  }

  const members = await Member.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return res.json(members);
});

router.get("/:id", async (req, res) => {
  if (!isValidMemberId(req.params.id)) {
    return res.status(400).json({ error: "Invalid member ID." });
  }

  if (!isDatabaseConnected()) {
    const member = memoryMembers.find((item) => item._id === req.params.id);
    return member ? res.json(member) : res.status(404).json({ error: "Member not found." });
  }

  const member = await Member.findById(req.params.id).lean();
  if (!member) {
    return res.status(404).json({ error: "Member not found." });
  }

  return res.json(member);
});

router.post("/", async (req, res) => {
  const payload = getMemberPayload(req.body, res, true);
  if (!payload) return;

  if (!isDatabaseConnected()) {
    if (!validateMemoryMember(payload)) {
      return res.status(400).json({ error: "Member validation failed." });
    }
    if (memoryMembers.some((item) => item.email === payload.email.toLowerCase())) {
      return res.status(409).json({ error: "A member with this email already exists." });
    }
    const now = new Date().toISOString();
    const member = {
      _id: newMemoryId(),
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      membershipType: payload.membershipType.trim(),
      createdAt: now,
      updatedAt: now
    };
    memoryMembers.push(member);
    return res.status(201).json(member);
  }

  const member = await Member.create(payload);
  return res.status(201).json(member);
});

router.patch("/:id", async (req, res) => {
  if (!isValidMemberId(req.params.id)) {
    return res.status(400).json({ error: "Invalid member ID." });
  }

  const payload = getMemberPayload(req.body, res);
  if (!payload) return;

  if (!isDatabaseConnected()) {
    const member = memoryMembers.find((item) => item._id === req.params.id);
    if (!member) return res.status(404).json({ error: "Member not found." });
    const updated = { ...member, ...payload, updatedAt: new Date().toISOString() };
    if (!validateMemoryMember(updated)) {
      return res.status(400).json({ error: "Member validation failed." });
    }
    if (memoryMembers.some((item) => item._id !== req.params.id && item.email === updated.email.toLowerCase())) {
      return res.status(409).json({ error: "A member with this email already exists." });
    }
    Object.assign(member, updated);
    member.email = member.email.toLowerCase();
    return res.json(member);
  }

  const member = await Member.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true
  });

  if (!member) {
    return res.status(404).json({ error: "Member not found." });
  }

  return res.json(member);
});

router.delete("/:id", async (req, res) => {
  if (!isValidMemberId(req.params.id)) {
    return res.status(400).json({ error: "Invalid member ID." });
  }

  if (!isDatabaseConnected()) {
    const index = memoryMembers.findIndex((item) => item._id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Member not found." });
    memoryMembers.splice(index, 1);
    return res.status(204).end();
  }

  const member = await Member.findByIdAndDelete(req.params.id);
  if (!member) {
    return res.status(404).json({ error: "Member not found." });
  }

  return res.status(204).end();
});

module.exports = router;
