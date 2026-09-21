import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { environmentSchema } from './environment.schema.js';
// Load the private environment relative to this source file.
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
const env = environmentSchema.parse(process.env);
export const config = {
  ...env,
  serveClient:
    env.SERVE_CLIENT === undefined ? env.NODE_ENV === 'production' : env.SERVE_CLIENT === 'true',
  cookieName: env.NODE_ENV === 'production' ? '__Host-flowboard' : 'flowboard',
  tokenSeconds: 3600,
};
