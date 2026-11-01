const mongoose = require('mongoose');

function resolveMongoUri() {
  if (process.env.MONGO_URI) return process.env.MONGO_URI;
  const atlas = String(process.env.MONGODB_URI || '').trim().replace(/^"|"$/g, '');
  if (!atlas) throw new Error('Set MONGO_URI or MONGODB_URI.');
  const withoutQuery = atlas.split('?')[0].replace(/\/$/, '');
  const afterScheme = withoutQuery.replace(/^mongodb(\+srv)?:\/\//, '');
  if (!afterScheme.includes('/')) {
    return `${withoutQuery}/nexora?retryWrites=true&w=majority`;
  }
  return atlas.includes('?') ? atlas : `${withoutQuery}?retryWrites=true&w=majority`;
}

async function connectDb(uri) {
  const target = uri || resolveMongoUri();
  mongoose.set('strictQuery', true);
  await mongoose.connect(target);
  console.log('Connected to MongoDB');
}

module.exports = { connectDb };
