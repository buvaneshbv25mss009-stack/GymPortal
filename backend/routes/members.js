const express = require("express");
const mongoose = require("mongoose");
const Member = require("../models/Member");

const router = express.Router();
const allowedFields = new Set(["name", "email", "membershipType"]);

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
  const members = await Member.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json(members);
});

router.get("/:id", async (req, res) => {
  if (!isValidMemberId(req.params.id)) {
    return res.status(400).json({ error: "Invalid member ID." });
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

  const member = await Member.create(payload);
  return res.status(201).json(member);
});

router.patch("/:id", async (req, res) => {
  if (!isValidMemberId(req.params.id)) {
    return res.status(400).json({ error: "Invalid member ID." });
  }

  const payload = getMemberPayload(req.body, res);
  if (!payload) return;

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

  const member = await Member.findByIdAndDelete(req.params.id);
  if (!member) {
    return res.status(404).json({ error: "Member not found." });
  }

  return res.status(204).end();
});

module.exports = router;
