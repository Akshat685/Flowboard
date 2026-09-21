import { isIP } from 'node:net';
import { z } from 'zod';

function trustedAddress(value) {
  if (value === 'loopback') return true;
  const [address, bits, extra] = value.split('/');
  const family = isIP(address);
  return (
    Boolean(family) &&
    extra === undefined &&
    (bits === undefined || (/^\d+$/.test(bits) && Number(bits) <= (family === 4 ? 32 : 128)))
  );
}

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4001),
    HOST: z.string().min(1).default('127.0.0.1'),
    MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
    CLIENT_ORIGIN: z
      .string()
      .url()
      .refine((value) => {
        if (!URL.canParse(value)) return false;
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
      }, 'Use an HTTP(S) origin only, without a path or trailing slash'),
    JWT_SECRET: z
      .string()
      .min(48)
      .refine((value) => !value.startsWith('REPLACE_'), 'Run npm run setup'),
    TRUST_PROXY: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      )
      .refine(
        (values) => values.every(trustedAddress),
        'Use trusted proxy IP addresses, CIDRs, or loopback; never true or a hop count',
      ),
    SERVE_CLIENT: z.enum(['true', 'false']).optional(),
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.CLIENT_ORIGIN.startsWith('https://'), {
    path: ['CLIENT_ORIGIN'],
    message: 'Production requires HTTPS for secure session cookies',
  });
