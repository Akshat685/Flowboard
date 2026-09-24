import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { boardController } from './boards.controller.js';
export function boardRoutes(io) {
  const router = Router();
  const controller = boardController(io);
  router.use(requireAuth);
  router.get('/', controller.list);
  router.post('/', controller.create);
  // Every nested operation loads a board scoped to the signed-in owner first.
  router.use('/:boardId', controller.loadOwned);
  router.get('/:boardId', controller.get);
  router.patch('/:boardId', controller.update);
  router.delete('/:boardId', controller.remove);
  router.get('/:boardId/columns', controller.columns);
  router.get('/:boardId/columns/:columnId', controller.column);
  router.post('/:boardId/columns', controller.createColumn);
  router.patch('/:boardId/columns/:columnId', controller.updateColumn);
  router.delete('/:boardId/columns/:columnId', controller.deleteColumn);
  const cardsPath = '/:boardId/columns/:columnId/cards';
  router.get(cardsPath, controller.cards);
  router.get(`${cardsPath}/:cardId`, controller.card);
  router.post(cardsPath, controller.createCard);
  router.patch(`${cardsPath}/:cardId`, controller.updateCard);
  router.delete(`${cardsPath}/:cardId`, controller.deleteCard);
  router.post('/:boardId/cards/:cardId/move', controller.moveCard);
  const commentsPath = `${cardsPath}/:cardId/comments`;
  router.post(commentsPath, controller.addComment);
  router.delete(`${commentsPath}/:commentId`, controller.deleteComment);
  return router;
}
