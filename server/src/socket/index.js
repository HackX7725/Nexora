const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { User } = require('../models/User');
const { Room } = require('../models/Room');
const { Stroke } = require('../models/Stroke');
const { readCookie, COOKIE } = require('../middleware/auth');

const MAX_POINTS = 4000;
const MAX_STROKES = 800;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function publicStroke(stroke) {
  return stroke.toPublic();
}

function sanitizeStroke(body) {
  const tool = body?.tool === 'eraser' ? 'eraser' : body?.tool === 'pen' ? 'pen' : '';
  const color = COLOR_RE.test(body?.color || '') ? body.color : '';
  const width = Number(body?.width);
  const points = Array.isArray(body?.points) ? body.points.slice(0, MAX_POINTS) : [];
  const cleanPoints = points
    .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
  if (!tool || !color || !Number.isFinite(width) || width < 1 || width > 48 || cleanPoints.length < 1) {
    return null;
  }
  return { tool, color, width, points: cleanPoints };
}

async function memberRoom(roomId, userId) {
  if (!roomId || !String(roomId).match(/^[a-f\d]{24}$/i)) return null;
  const room = await Room.findById(roomId).select('host members');
  if (!room) return null;
  const member = room.members.some((id) => String(id) === String(userId));
  return member ? room : null;
}

function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, COOKIE);
      if (!token) return next(new Error('Sign in to continue.'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub).select('name');
      if (!user) return next(new Error('Sign in to continue.'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Sign in to continue.'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('room:join', async ({ roomId } = {}) => {
      const room = await memberRoom(roomId, socket.user.id);
      if (!room) {
        socket.emit('room:error', { message: 'You are not a member of this room.' });
        return;
      }
      socket.join(String(room.id));
      const strokes = await Stroke.find({ room: room.id }).sort({ createdAt: 1 }).limit(MAX_STROKES);
      socket.emit('strokes:init', strokes.map(publicStroke));
    });

    socket.on('stroke:draw', async (body = {}) => {
      const room = await memberRoom(body.roomId, socket.user.id);
      const stroke = sanitizeStroke(body);
      if (!room || !stroke) return;
      const saved = await Stroke.create({ ...stroke, room: room.id, author: socket.user.id });
      const count = await Stroke.countDocuments({ room: room.id });
      if (count > MAX_STROKES) {
        const overflow = await Stroke.find({ room: room.id }).sort({ createdAt: 1 }).limit(count - MAX_STROKES).select('_id');
        await Stroke.deleteMany({ _id: { $in: overflow.map((item) => item._id) } });
      }
      socket.to(String(room.id)).emit('stroke:add', publicStroke(saved));
    });

    socket.on('board:clear', async ({ roomId } = {}) => {
      const room = await memberRoom(roomId, socket.user.id);
      if (!room || String(room.host) !== String(socket.user.id)) return;
      await Stroke.deleteMany({ room: room.id });
      io.to(String(room.id)).emit('board:cleared');
    });
  });

  return io;
}

module.exports = { attachSocket };
