import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { io } from 'socket.io-client';
import { boardsApi } from '../boards.api';
import { authApi } from '@/features/auth/auth.api';
import { socketOrigin } from '@/services/http';
import { errorMessage, errorStatus } from '@/utils/errors';
const BoardContext = createContext(null);
const initial = {
  boards: [],
  page: 1,
  pages: 1,
  total: 0,
  board: null,
  loadingList: true,
  loadingBoard: false,
  busy: false,
  error: '',
  live: false,
};
export function BoardProvider({ children }) {
  const [state, dispatch] = useReducer((old, patch) => ({ ...old, ...patch }), initial);
  const activeId = useRef(null);
  const sequence = useRef({ list: 0, board: 0 });
  const pending = useRef(false);
  const mounted = useRef(true);
  const listPage = useRef(1);
  const requests = useRef({ list: null, board: null });
  const patch = useCallback((value) => {
    if (mounted.current) dispatch(value);
  }, []);
  const loadList = useCallback(
    async (page = listPage.current) => {
      listPage.current = page;
      requests.current.list?.abort();
      const controller = new AbortController();
      requests.current.list = controller;
      const seq = ++sequence.current.list;
      try {
        const {
          boards,
          page: currentPage = 1,
          pages = 1,
          total = 0,
        } = await boardsApi.boards(page, { signal: controller.signal });
        if (seq === sequence.current.list) {
          listPage.current = currentPage;
          patch({ boards, page: currentPage, pages, total, loadingList: false });
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        if (seq === sequence.current.list)
          patch({ error: errorMessage(error), loadingList: false });
      }
    },
    [patch],
  );
  const loadBoard = useCallback(
    async (id = activeId.current) => {
      if (!id) return;
      requests.current.board?.abort();
      const controller = new AbortController();
      requests.current.board = controller;
      const seq = ++sequence.current.board;
      try {
        const { board } = await boardsApi.board(id, { signal: controller.signal });
        if (id === activeId.current && seq === sequence.current.board)
          patch({ board, loadingBoard: false });
      } catch (error) {
        if (error.name === 'AbortError') return;
        if (id === activeId.current && seq === sequence.current.board)
          patch({
            error: errorMessage(error),
            loadingBoard: false,
            ...(errorStatus(error) === 404 ? { board: null } : {}),
          });
      }
    },
    [patch],
  );
  const selectBoard = useCallback(
    (id) => {
      activeId.current = id;
      requests.current.board?.abort();
      ++sequence.current.board;
      patch({ board: null, loadingBoard: Boolean(id), error: '' });
      if (id) void loadBoard(id);
    },
    [loadBoard, patch],
  );
  const run = useCallback(
    async (operation) => {
      if (pending.current) return null;
      pending.current = true;
      patch({ busy: true, error: '' });
      let result = null;
      try {
        result = await operation();
      } catch (error) {
        patch({ error: errorMessage(error) });
      } finally {
        // Also reconcile after 409 conflicts or ambiguous network failures.
        await Promise.all([loadList(), loadBoard()]);
        pending.current = false;
        patch({ busy: false });
      }
      return result;
    },
    [loadBoard, loadList, patch],
  );
  useEffect(() => {
    mounted.current = true;
    void loadList();
    const socket = io(socketOrigin, { withCredentials: true });
    let active = true;
    let reconnectTimer;
    const retrySocket = () => {
      if (!active || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        if (active && !socket.connected) socket.connect();
      }, 10000);
    };
    const refresh = () => {
      void loadList();
      void loadBoard();
    };
    socket.on('session:ready', () => {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      patch({ live: true });
      refresh();
    });
    socket.on('boards:changed', ({ boardId }) => {
      void loadList();
      if (boardId === activeId.current) void loadBoard();
    });
    socket.on('connect_error', () => {
      patch({ live: false });
      retrySocket();
    });
    socket.on('disconnect', (reason) => {
      patch({ live: false });
      if (reason === 'io server disconnect') {
        void authApi
          .me()
          .then(() => {
            if (active) socket.connect();
          })
          .catch((error) => {
            if (errorStatus(error) !== 401) retrySocket();
          });
      }
    });
    // Re-fetch after a reconnect or missed event; REST remains the source of truth.
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 60000);
    return () => {
      active = false;
      clearTimeout(reconnectTimer);
      mounted.current = false;
      ++sequence.current.list;
      ++sequence.current.board;
      requests.current.list?.abort();
      requests.current.board?.abort();
      socket.disconnect();
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [loadList, loadBoard, patch]);
  return (
    <BoardContext.Provider
      value={{
        ...state,
        run,
        selectBoard,
        loadList,
        loadBoard,
        changePage: (page) => {
          patch({ loadingList: true, error: '' });
          void loadList(page);
        },
        clearError: () => patch({ error: '' }),
      }}
    >
      {children}
    </BoardContext.Provider>
  );
}
export function useBoards() {
  const context = useContext(BoardContext);
  if (!context) throw new Error('useBoards must be used within BoardProvider');
  return context;
}
