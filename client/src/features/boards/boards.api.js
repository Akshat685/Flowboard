import { request, write } from '@/services/http';
const boardPath = (id) => `/boards/${id}`;
const colPath = (id, col) => `${boardPath(id)}/columns/${col}`;
const cardPath = (id, col, card) => `${colPath(id, col)}/cards/${card}`;
export const boardsApi = {
  boards: (page = 1, options) => request(`/boards?page=${page}`, options),
  board: (id, options) => request(boardPath(id), options),
  createBoard: (input) => write('/boards', 'POST', input),
  updateBoard: (id, input, version) => write(boardPath(id), 'PATCH', { ...input, version }),
  deleteBoard: (id, version) => write(boardPath(id), 'DELETE', { version }),
  columns: (id) => request(`${boardPath(id)}/columns`),
  column: (id, col) => request(colPath(id, col)),
  createColumn: (id, input, version) =>
    write(`${boardPath(id)}/columns`, 'POST', { ...input, version }),
  updateColumn: (id, col, input, version) =>
    write(colPath(id, col), 'PATCH', { ...input, version }),
  deleteColumn: (id, col, version) => write(colPath(id, col), 'DELETE', { version }),
  cards: (id, col) => request(`${colPath(id, col)}/cards`),
  card: (id, col, card) => request(cardPath(id, col, card)),
  createCard: (id, col, input, version) =>
    write(`${colPath(id, col)}/cards`, 'POST', { ...input, version }),
  updateCard: (id, col, card, input, version) =>
    write(cardPath(id, col, card), 'PATCH', { ...input, version }),
  deleteCard: (id, col, card, version) => write(cardPath(id, col, card), 'DELETE', { version }),
  moveCard: (id, card, input, version) =>
    write(`${boardPath(id)}/cards/${card}/move`, 'POST', { ...input, version }),
};
