const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const http = require('http');
const { createApp } = require('./app');
const { connectDb } = require('./config/db');
const { attachSocket } = require('./socket');

const PORT = Number(process.env.PORT) || 5000;

async function main() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required.');
  await connectDb();
  const app = createApp();
  const server = http.createServer(app);
  const io = attachSocket(server);
  app.set('io', io);
  server.listen(PORT, () => {
    console.log(`Nexora API listening on ${PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
