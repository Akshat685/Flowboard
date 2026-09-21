import { z } from 'zod';
import { title } from './common.js';
// TextEncoder has identical UTF-8 length semantics in Node and the browser.
const password = z
  .string()
  .min(8)
  .max(72)
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    'Password must be at most 72 UTF-8 bytes',
  );
export const credentials = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password,
  })
  .strict();
export const registration = credentials.extend({ name: title(80) });
