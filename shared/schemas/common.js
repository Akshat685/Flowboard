import { z } from 'zod';
export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid document ID');
export const title = (max) => z.string().trim().min(1).max(max);
export const versionInput = z.object({ version: z.number().int().nonnegative() }).strict();
export const withVersion = (schema) => schema.extend(versionInput.shape);
