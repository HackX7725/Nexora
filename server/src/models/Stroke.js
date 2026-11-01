const mongoose = require('mongoose');

const strokeSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tool: { type: String, enum: ['pen', 'eraser'], required: true },
    color: { type: String, required: true },
    width: { type: Number, required: true },
    points: {
      type: [{ x: Number, y: Number }],
      required: true,
    },
  },
  { timestamps: true }
);

strokeSchema.methods.toPublic = function toPublic() {
  return {
    id: this.id,
    tool: this.tool,
    color: this.color,
    width: this.width,
    points: this.points.map((point) => ({ x: point.x, y: point.y })),
    authorId: String(this.author),
    createdAt: this.createdAt,
  };
};

const Stroke = mongoose.model('Stroke', strokeSchema);

module.exports = { Stroke };
