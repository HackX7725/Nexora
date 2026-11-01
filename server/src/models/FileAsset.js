const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    mime: { type: String, default: 'application/octet-stream' },
    size: { type: Number, required: true },
  },
  { timestamps: true }
);

fileSchema.methods.toPublic = function toPublic() {
  const uploader = this.uploader;
  return {
    id: this.id,
    originalName: this.originalName,
    mime: this.mime,
    size: this.size,
    createdAt: this.createdAt,
    uploader: {
      id: String(uploader._id || uploader),
      name: uploader.name || '',
    },
  };
};

const FileAsset = mongoose.model('FileAsset', fileSchema);

module.exports = { FileAsset };
