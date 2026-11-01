const express = require('express');
const { User } = require('../models/User');
const { asyncHandler, httpError } = require('../lib/http');
const { requireAuth } = require('../middleware/auth');
const {
  chatConfigured,
  chatSession,
  ensureChatUser,
  createChatGroup,
  addChatMember,
} = require('../services/agora');

const router = express.Router();

router.use(requireAuth);

router.get('/session', asyncHandler(async (req, res) => {
  if (!chatConfigured()) {
    throw httpError(503, 'Agora Chat is not configured on the server.');
  }
  await ensureChatUser(req.user.id);
  res.json({ chat: await chatSession(req.user) });
}));

router.get('/people', asyncHandler(async (req, res) => {
  const people = await User.find({ _id: { $ne: req.user._id } }).select('name').sort({ name: 1 }).limit(200);
  res.json({
    people: people.map((person) => ({ id: person.id, name: person.name })),
  });
}));

router.post('/groups', asyncHandler(async (req, res) => {
  if (!chatConfigured()) {
    throw httpError(503, 'Agora Chat is not configured on the server.');
  }
  const title = String(req.body.title || '').trim();
  const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds.map(String) : [];
  if (title.length < 2 || title.length > 80) {
    throw httpError(400, 'Give the group a name between 2 and 80 characters.');
  }

  await ensureChatUser(req.user.id);
  const members = [];
  for (const id of memberIds) {
    if (id === String(req.user.id)) continue;
    const person = await User.findById(id).select('name');
    if (!person) continue;
    await ensureChatUser(person.id);
    members.push(person.id);
  }

  const groupId = await createChatGroup({ title, ownerId: req.user.id });
  for (const id of members) {
    await addChatMember(groupId, id);
  }
  res.status(201).json({ group: { id: groupId, title } });
}));

module.exports = router;
