const isProd = process.env.NODE_ENV === 'production';

function timestamp() {
  return new Date().toISOString();
}

function format(level, message, meta) {
  if (isProd) {
    return JSON.stringify({ timestamp: timestamp(), level, message, ...meta });
  }
  const prefix = `[${timestamp()}] ${level.toUpperCase()}:`;
  const metaStr = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${prefix} ${message}${metaStr}`;
}

export const logger = {
  info(message, meta = {}) {
    process.stdout.write(format('info', message, meta) + '\n');
  },
  warn(message, meta = {}) {
    process.stdout.write(format('warn', message, meta) + '\n');
  },
  error(message, meta = {}) {
    process.stderr.write(format('error', message, meta) + '\n');
  },
};
