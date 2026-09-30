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

function makeLogger(baseMeta = {}) {
  return {
    info(message, meta = {}) {
      process.stdout.write(format('info', message, { ...baseMeta, ...meta }) + '\n');
    },
    warn(message, meta = {}) {
      process.stdout.write(format('warn', message, { ...baseMeta, ...meta }) + '\n');
    },
    error(message, meta = {}) {
      process.stderr.write(format('error', message, { ...baseMeta, ...meta }) + '\n');
    },
    /** Create a child logger that inherits and extends the base metadata. */
    child(childMeta) {
      return makeLogger({ ...baseMeta, ...childMeta });
    },
  };
}

export const logger = makeLogger();
