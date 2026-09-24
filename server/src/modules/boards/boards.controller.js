import { authenticatedUser } from '../../middleware/auth.middleware.js';
import { AppError } from '../../errors/AppError.js';
import {
  boardListInput,
  boardInput,
  columnInput,
  cardInput,
  commentInput,
  versionInput,
  withVersion,
  moveInput,
} from './boards.validation.js';
import { boardService, findColumn, findCard, findComment } from './boards.service.js';
function loadedBoard(req) {
  if (!req.board) throw new AppError(404, 'Board not found');
  return req.board;
}
export function boardController(io) {
  const service = boardService(io);
  return {
    list: async (req, res) => {
      res.json(await service.list(authenticatedUser(req)._id, boardListInput.parse(req.query)));
    },
    create: async (req, res) => {
      const input = boardInput.parse(req.body);
      const board = await service.create(authenticatedUser(req)._id, input);
      res.status(201).json({ board });
    },
    loadOwned: async (req, _res, next) => {
      req.board = await service.findOwned(authenticatedUser(req)._id, req.params.boardId);
      next();
    },
    get: (req, res) => {
      res.json({ board: loadedBoard(req) });
    },
    update: async (req, res) => {
      const { version, ...input } = withVersion(boardInput.partial()).parse(req.body);
      res.json({ board: await service.update(loadedBoard(req), input, version) });
    },
    remove: async (req, res) => {
      const { version } = versionInput.parse(req.body);
      await service.remove(loadedBoard(req), authenticatedUser(req)._id, version);
      res.status(204).end();
    },
    columns: (req, res) => {
      res.json({ columns: loadedBoard(req).columns });
    },
    column: (req, res) => {
      res.json({ column: findColumn(loadedBoard(req), req.params.columnId) });
    },
    createColumn: async (req, res) => {
      const { version, ...input } = withVersion(columnInput).parse(req.body);
      res.status(201).json({ board: await service.createColumn(loadedBoard(req), input, version) });
    },
    updateColumn: async (req, res) => {
      const { version, ...input } = withVersion(columnInput).parse(req.body);
      res.json({
        board: await service.updateColumn(loadedBoard(req), req.params.columnId, input, version),
      });
    },
    deleteColumn: async (req, res) => {
      const { version } = versionInput.parse(req.body);
      res.json({
        board: await service.deleteColumn(loadedBoard(req), req.params.columnId, version),
      });
    },
    cards: (req, res) => {
      res.json({ cards: findColumn(loadedBoard(req), req.params.columnId).cards });
    },
    card: (req, res) => {
      res.json({
        card: findCard(findColumn(loadedBoard(req), req.params.columnId), req.params.cardId),
      });
    },
    createCard: async (req, res) => {
      const { version, ...input } = withVersion(cardInput).parse(req.body);
      res.status(201).json({
        board: await service.createCard(loadedBoard(req), req.params.columnId, input, version),
      });
    },
    updateCard: async (req, res) => {
      const { version, ...input } = withVersion(cardInput.partial()).parse(req.body);
      res.json({
        board: await service.updateCard(
          loadedBoard(req),
          req.params.columnId,
          req.params.cardId,
          input,
          version,
        ),
      });
    },
    deleteCard: async (req, res) => {
      const { version } = versionInput.parse(req.body);
      res.json({
        board: await service.deleteCard(
          loadedBoard(req),
          req.params.columnId,
          req.params.cardId,
          version,
        ),
      });
    },
    moveCard: async (req, res) => {
      const input = moveInput.parse(req.body);
      res.json({ board: await service.moveCard(loadedBoard(req), req.params.cardId, input) });
    },
    addComment: async (req, res) => {
      const { version, ...input } = withVersion(commentInput).parse(req.body);
      res.status(201).json({
        board: await service.addComment(
          loadedBoard(req),
          req.params.columnId,
          req.params.cardId,
          input,
          version,
        ),
      });
    },
    deleteComment: async (req, res) => {
      const { version } = versionInput.parse(req.body);
      res.json({
        board: await service.deleteComment(
          loadedBoard(req),
          req.params.columnId,
          req.params.cardId,
          req.params.commentId,
          version,
        ),
      });
    },
  };
}
