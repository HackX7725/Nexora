const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { FileAsset } = require('../models/FileAsset');
const { asyncHandler, httpError } = require('../lib/http');
const { requireAuth } = require('../middleware/auth');
const { findMemberRoom } = require('./rooms');

const router = express.Router();
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
const BLOCKED = new Set(['.exe', '.bat', '.cmd', '.msi', '.com', '.scr', '.ps1', '.sh', '.js', '.jar', '.vbs']);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 10);
    const safeExt = /^\.[a-z0-9]+$/.test(ext) && !BLOCKED.has(ext) ? ext : '';
    cb(null, `${crypto.randomBytes(16).toString('hex')}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (BLOCKED.has(ext)) {
      cb(httpError(400, 'That file type is not allowed.'));
      return;
    }
    cb(null, true);
  },
});

router.use(requireAuth);

function safePath(storedName) {
  const full = path.resolve(UPLOAD_DIR, storedName);
  if (!full.startsWith(`${UPLOAD_DIR}${path.sep}`)) throw httpError(400, 'File not found.');
  return full;
}

router.get('/:id/files', asyncHandler(async (req, res) => {
  await findMemberRoom(req.params.id, req.user.id);
  const files = await FileAsset.find({ room: req.params.id }).populate('uploader', 'name').sort({ createdAt: -1 });
  res.json({ files: files.map((file) => file.toPublic()) });
}));

router.post('/:id/files', asyncHandler(async (req, res, next) => {
  await findMemberRoom(req.params.id, req.user.id);
  next();
}), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw httpError(400, 'Choose a file to upload.');

  const record = await FileAsset.create({
    room: req.params.id,
    uploader: req.user._id,
    originalName: path.basename(req.file.originalname).slice(0, 180) || 'file',
    storedName: req.file.filename,
    mime: req.file.mimetype || 'application/octet-stream',
    size: req.file.size,
  });
  await record.populate('uploader', 'name');
  const file = record.toPublic();
  req.app.get('io')?.to(String(req.params.id)).emit('file:added', file);
  res.status(201).json({ file });
}));

router.get('/:id/files/:fileId/download', asyncHandler(async (req, res) => {
  await findMemberRoom(req.params.id, req.user.id);
  const record = await FileAsset.findOne({ _id: req.params.fileId, room: req.params.id });
  if (!record) throw httpError(404, 'File not found.');
  const full = safePath(record.storedName);
  if (!fs.existsSync(full)) throw httpError(404, 'File not found.');
  res.download(full, record.originalName);
}));

module.exports = router;
