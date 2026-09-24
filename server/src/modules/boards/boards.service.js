import { Board } from './boards.model.js';
import { objectId } from './boards.validation.js';
import { AppError } from '../../errors/AppError.js';
export function findColumn(board, id) {
  const found = board.columns.id(objectId.parse(id));
  if (!found) throw new AppError(404, 'Column not found');
  return found;
}
export function findCard(column, id) {
  const found = column.cards.id(objectId.parse(id));
  if (!found) throw new AppError(404, 'Card not found');
  return found;
}
export function findComment(card, id) {
  const found = card.comments.id(objectId.parse(id));
  if (!found) throw new AppError(404, 'Comment not found');
  return found;
}
function checkVersion(board, version) {
  if (board.__v !== version)
    throw new AppError(409, 'This board changed. Reload it and retry your action.');
}
export function boardService(io) {
  const notify = (board) => {
    io.to(`user:${board.owner}`).emit('boards:changed', { boardId: board._id.toString() });
  };
  const save = async (board) => {
    await board.save();
    notify(board);
    return board;
  };
  return {
    async list(owner, { page, limit }) {
      const total = await Board.countDocuments({ owner });
      const pages = Math.max(1, Math.ceil(total / limit));
      const currentPage = Math.min(page, pages);
      const boards = await Board.find({ owner })
        .select('-columns')
        .sort({ updatedAt: -1, _id: -1 })
        .skip((currentPage - 1) * limit)
        .limit(limit)
        .lean();
      return { boards, page: currentPage, pages, total };
    },
    async create(owner, input) {
      const board = await Board.create({
        ...input,
        owner,
        columns: [{ title: 'To do' }, { title: 'In progress' }, { title: 'Done' }],
      });
      notify(board);
      return board;
    },
    async findOwned(owner, id) {
      const board = await Board.findOne({ _id: objectId.parse(id), owner });
      if (!board) throw new AppError(404, 'Board not found');
      return board;
    },
    async update(board, input, version) {
      checkVersion(board, version);
      Object.assign(board, input);
      return save(board);
    },
    async remove(board, owner, version) {
      checkVersion(board, version);
      const result = await Board.deleteOne({ _id: board._id, owner, __v: version });
      if (!result.deletedCount)
        throw new AppError(409, 'This board changed. Reload it and retry your action.');
      notify(board);
    },
    async createColumn(board, input, version) {
      checkVersion(board, version);
      board.columns.push(input);
      return save(board);
    },
    async updateColumn(board, id, input, version) {
      checkVersion(board, version);
      Object.assign(findColumn(board, id), input);
      return save(board);
    },
    async deleteColumn(board, id, version) {
      checkVersion(board, version);
      findColumn(board, id).deleteOne();
      return save(board);
    },
    async createCard(board, columnId, input, version) {
      checkVersion(board, version);
      findColumn(board, columnId).cards.push(input);
      return save(board);
    },
    async updateCard(board, columnId, cardId, input, version) {
      checkVersion(board, version);
      Object.assign(findCard(findColumn(board, columnId), cardId), input);
      return save(board);
    },
    async deleteCard(board, columnId, cardId, version) {
      checkVersion(board, version);
      findCard(findColumn(board, columnId), cardId).deleteOne();
      return save(board);
    },
    async moveCard(board, cardId, input) {
      checkVersion(board, input.version);
      const source = findColumn(board, input.sourceColumnId);
      const target = findColumn(board, input.targetColumnId);
      const moving = findCard(source, cardId);
      const data = moving.toObject(); // Preserve ID, metadata and creation timestamp.
      moving.deleteOne();
      if (input.targetIndex > target.cards.length)
        throw new AppError(400, 'Destination index is out of range');
      target.cards.splice(input.targetIndex, 0, data);
      // Removing and inserting the card commit atomically in one document save.
      return save(board);
    },
    async addComment(board, columnId, cardId, input, version) {
      checkVersion(board, version);
      findCard(findColumn(board, columnId), cardId).comments.push(input);
      return save(board);
    },
    async deleteComment(board, columnId, cardId, commentId, version) {
      checkVersion(board, version);
      findComment(findCard(findColumn(board, columnId), cardId), commentId).deleteOne();
      return save(board);
    },
  };
}
