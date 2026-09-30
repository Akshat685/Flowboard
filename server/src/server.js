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
    pid: process.pid,
  });

  let stopping = false;
  const shutdown = (signal) => {
    if (stopping) return;
    stopping = true;
    logger.info(`Graceful shutdown initiated (${signal})`);
    // Hard deadline: force-exit after 15 seconds if graceful shutdown stalls.
    const deadline = setTimeout(() => {
      logger.error('Shutdown deadline exceeded — forcing exit');
      process.exit(1);
    }, 15_000);
    deadline.unref();
    // 1. Stop accepting new connections
    server.close(() => {
      // 2. Disconnect all sockets
      io.close(async () => {
        // 3. Close database
        await disconnectDatabase();
        logger.info('Shutdown complete');
        process.exit(0);
      });
    });
    // Immediately stop accepting new Socket.IO connections while HTTP drains
    io.disconnectSockets(true);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : '';
  logger.error(`Startup failed: ${message}`);
  if (stack) logger.error(stack);
  await disconnectDatabase();
  process.exitCode = 1;
}

