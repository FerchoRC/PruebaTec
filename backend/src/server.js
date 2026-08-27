import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createPool } from './db/pool.js';

function main() {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(`[config] ${error.message}`);
    process.exit(1);
  }

  const pool = createPool(config);
  const app = createApp({ pool, corsOrigin: config.corsOrigin });

  const server = app.listen(config.port, () => {
    console.log(`[server] escuchando en http://0.0.0.0:${config.port} (${config.nodeEnv})`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} recibido, cerrando...`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
