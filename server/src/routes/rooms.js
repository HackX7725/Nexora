const crypto = require('crypto');
const express = require('express');
const { Room } = require('../models/Room');
const { asyncHandler, httpError } = require('../lib/http');
const { validateTitle, validateMode } = require('../lib/validators');
const { requireAuth } = require('../middleware/auth');
const {
  rtcConfigured,
  chatConfigured,
  ensureChatUser,
  createChatGroup,
  mediaCredentials,
  chatCredentials,
} = require('../services/agora');

const router = express.Router();
const INVITE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

router.use(requireAuth);

function inviteCode() {
  let code = '';
  for (let i = 0; i < 8; i += 1) {
    code += INVITE_ALPHABET[crypto.randomInt(0, INVITE_ALPHABET.length)];
  }
  return code;
}

function agoraSecret() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  const bytes = crypto.randomBytes(32);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function rosterFrom(room) {
  return (room.members || []).map((member) => ({
    id: String(member._id || member),
    name: member.name || 'Member',
    agoraUid: member.agoraUid || null,
  }));
}

async function findMemberRoom(id, userId) {
  if (!id || !id.match(/^[a-f\d]{24}$/i)) throw httpError(404, 'Room not found.');
  const room = await Room.findById(id).populate('members', 'name agoraUid');
  if (!room) throw httpError(404, 'Room not found.');
  const member = room.members.some((person) => String(person._id || person) === String(userId));
  if (!member) throw httpError(403, 'You are not a member of this room.');
  return room;
}

async function provisionChat(room, ownerId) {
  if (!chatConfigured()) return;
  await ensureChatUser(ownerId);
  if (!room.chatGroupId) {
    room.chatGroupId = await createChatGroup({ title: room.title, ownerId });
  }
}

router.post('/', asyncHandler(async (req, res) => {
  const titleResult = validateTitle(req.body.title);
  const modeResult = validateMode(req.body.mode);
  const errors = {};
  if (titleResult.error) errors.title = titleResult.error;
  if (modeResult.error) errors.mode = modeResult.error;
  if (Object.keys(errors).length) throw httpError(400, 'Check the form and try again.', { errors });

  const code = inviteCode();
  const room = new Room({
    title: titleResult.title,
    mode: modeResult.mode,
    channelName: `nx${code}`,
    inviteCode: code,
    host: req.user._id,
    members: [req.user._id],
  encryptionKey: agoraSecret(),
  encryptionSalt: crypto.randomBytes(32).toString('base64'),
  });

  try {
    await provisionChat(room, req.user.id);
  } catch (error) {
    console.error('Agora Chat group was not created:', error.message);
  }

  await room.save();
  const saved = await Room.findById(room.id).populate('members', 'name agoraUid');
  res.status(201).json({ room: saved.toSummary() });
}));

router.get('/', asyncHandler(async (req, res) => {
  const rooms = await Room.find({ members: req.user._id }).sort({ createdAt: -1 });
  res.json({ rooms: rooms.map((room) => room.toSummary()) });
}));

router.post('/join', asyncHandler(async (req, res) => {
  const inviteCodeValue = String(req.body.inviteCode || '').trim().toLowerCase();
  if (!inviteCodeValue) throw httpError(400, 'Enter an invite code.', { errors: { inviteCode: 'Enter an invite code.' } });

  const room = await Room.findOne({ inviteCode: inviteCodeValue });
  if (!room) throw httpError(404, 'That invite code does not match a room.', { errors: { inviteCode: 'That invite code does not match a room.' } });

  const already = room.members.some((id) => String(id) === String(req.user._id));
  if (!already) {
    room.members.push(req.user._id);
    await room.save();
  }

  res.json({ room: room.toSummary() });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const room = await findMemberRoom(req.params.id, req.user.id);
  res.json({
    room: {
      ...room.toSummary(),
      chatGroupId: room.chatGroupId || '',
      roster: rosterFrom(room),
    },
  });
}));

router.post('/:id/join', asyncHandler(async (req, res) => {
  const room = await findMemberRoom(req.params.id, req.user.id);
  const payload = {
    room: {
      ...room.toSummary(),
      roster: rosterFrom(room),
    },
    rtc: null,
    chat: null,
  };

  if (rtcConfigured()) {
    payload.rtc = mediaCredentials(room, req.user);
  }

  if (chatConfigured()) {
    try {
      payload.chat = await chatCredentials(room, req.user);
    } catch (error) {
      console.error('Agora Chat join failed:', error.message);
      payload.chatError = 'Chat could not be opened for this room.';
    }
  }

  res.json(payload);
}));

router.post('/:id/tokens', asyncHandler(async (req, res) => {
  const room = await findMemberRoom(req.params.id, req.user.id);
  if (!rtcConfigured()) throw httpError(503, 'Agora is not configured on the server.');

  const payload = { rtc: mediaCredentials(room, req.user), chat: null };
  if (chatConfigured() && room.chatGroupId) {
    try {
      payload.chat = await chatCredentials(room, req.user);
    } catch (error) {
      console.error('Agora Chat token renewal failed:', error.message);
    }
  }
  res.json(payload);
}));

module.exports = router;
module.exports.findMemberRoom = findMemberRoom;
