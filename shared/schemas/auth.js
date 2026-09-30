import { z } from 'zod';
import { title } from './common.js';
// TextEncoder has identical UTF-8 length semantics in Node and the browser.
const withinByteLimit = (value) => new TextEncoder().encode(value).length <= 72;
const password = z
  .string()
  .min(8)
  .max(72)
  .refine(withinByteLimit, 'Password must be at most 72 UTF-8 bytes');
const registrationPassword = password.refine(
  (value) =>
    /^[A-Z]/.test(value) &&
    /[A-Za-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value),
  'Password must start with a capital letter and include letters, a number, and 1 special character',
);
export const credentials = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password,
  })
  .strict();
export const registration = credentials
  .omit({ password: true })
  .extend({
    name: title(80),
    password: registrationPassword,
  })
  .strict();
