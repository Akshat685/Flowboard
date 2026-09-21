import { config } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createApplication } from './app.js';
import { logger } from './utils/logger.js';

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception — shutting down', { name: error.name, message: error.message });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logger.error('Unhandled promise rejection — shutting down', { message });
  process.exit(1);
});

try {
  await connectDatabase();
  const { server, io } = createApplication();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.PORT, config.HOST, resolve);
  });
  logger.info(`Flowboard API running`, {
    url: `http://localhost:${config.PORT}`,
    env: config.NODE_ENV,
  });

  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    logger.info('Graceful shutdown initiated');
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    io.close(async () => {
      await disconnectDatabase();
      logger.info('Shutdown complete');
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : '';
  logger.error(`Startup failed: ${message}`);
  if (stack) logger.error(stack);
  await disconnectDatabase();
  process.exitCode = 1;
}
