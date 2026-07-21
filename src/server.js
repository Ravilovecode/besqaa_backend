import app from './app.js';
import env from './config/env.js';
import { connectDB } from './config/db.js';

async function start() {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`🚀 Besqaa server running on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

start();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
