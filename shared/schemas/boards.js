import { z } from 'zod';
import { priorities } from '../constants/boards.js';
import { objectId, title, withVersion } from './common.js';
export const boardListInput = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(24),
  })
  .strict();
export const boardInput = z
  .object({ title: title(120), description: z.string().max(2000).optional() })
  .strict();
export const columnInput = z.object({ title: title(80) }).strict();
export const cardInput = z
  .object({
    title: title(160),
    description: z.string().max(5000).optional(),
    priority: z.enum(priorities).optional(),
    dueDate: z.iso.datetime().nullable().optional(),
    labels: z.array(title(32)).max(10).optional(),
  })
  .strict();
export const moveInput = withVersion(
  z
    .object({
      sourceColumnId: objectId,
      targetColumnId: objectId,
      // Destination index is measured after removing the dragged card.
      targetIndex: z.number().int().min(0).max(500),
    })
    .strict(),
);
