import mongoose from 'mongoose';
import { priorities } from '@flowboard/shared/constants';
// Array order IS display order. Columns and cards remain embedded documents.
export const commentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);
export const cardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: '', maxlength: 5000 },
    priority: { type: String, enum: priorities, default: 'medium' },
    dueDate: { type: Date, default: null },
    labels: {
      type: [{ type: String, trim: true, maxlength: 32 }],
      default: [],
      validate: (value) => value.length <= 10,
    },
    comments: {
      type: [commentSchema],
      default: [],
      validate: (value) => value.length <= 100,
    },
  },
  { timestamps: true },
);
export const columnSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    cards: { type: [cardSchema], default: [] },
  },
  { timestamps: true },
);
const boardSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 2000 },
    columns: {
      type: [columnSchema],
      default: [],
      validate: (value) => value.length <= 30,
    },
  },
  { timestamps: true, optimisticConcurrency: true },
);
boardSchema
  .path('columns')
  .validate(
    (columns) => columns.reduce((sum, column) => sum + column.cards.length, 0) <= 500,
    'A board can contain at most 500 cards',
  );
boardSchema.index({ owner: 1, updatedAt: -1, _id: -1 });
export const Board = mongoose.model('Board', boardSchema);
