const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    mode: { type: String, required: true, enum: ['video', 'voice'] },
    channelName: { type: String, required: true, unique: true },
    inviteCode: { type: String, required: true, unique: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    chatGroupId: { type: String, default: '' },
    encryptionKey: { type: String, required: true },
    encryptionSalt: { type: String, required: true },
  },
  { timestamps: true }
);

roomSchema.methods.toSummary = function toSummary() {
  return {
    id: this.id,
    title: this.title,
    mode: this.mode,
    inviteCode: this.inviteCode,
    hostId: String(this.host._id || this.host),
    memberCount: this.members.length,
    createdAt: this.createdAt,
  };
};

const Room = mongoose.model('Room', roomSchema);

module.exports = { Room };
