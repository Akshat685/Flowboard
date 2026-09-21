import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { boardsApi as api } from '@/features/boards/boards.api';
import { useBoards } from '@/features/boards/hooks/BoardContext';
import { Kanban } from '@/features/boards/components/Kanban';

export function BoardPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { board, loadingBoard, busy, run, selectBoard } = useBoards();

  useEffect(() => {
    selectBoard(boardId ?? null);
    return () => selectBoard(null);
  }, [boardId, selectBoard]);

  if (loadingBoard)
    return (
      <main id="main-content" tabIndex={-1} className="board-page" role="status">
        <div className="skeleton skeleton-title" style={{ width: '120px' }} />
        <div style={{ marginTop: '24px' }}>
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-text" style={{ width: '40%', marginTop: '8px' }} />
        </div>
        <div style={{ display: 'flex', gap: '20px', marginTop: '32px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ width: '320px', height: '300px', borderRadius: '14px' }} />
          ))}
        </div>
      </main>
    );

  if (!board || board._id !== boardId)
    return (
      <main id="main-content" tabIndex={-1} className="page">
        <div className="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <h3>Board unavailable</h3>
          <p>The board could not be opened. It may have been deleted or belong to another account.</p>
          <Link to="/boards" className="btn btn-primary">Back to boards</Link>
        </div>
      </main>
    );

  return (
    <main id="main-content" tabIndex={-1} className="board-page">
      <Link to="/boards" className="back-link">← All boards</Link>
      <div className="board-heading">
        <div>
          <p className="eyebrow">KEEP THINGS MOVING</p>
          <h1>{board.title}</h1>
          {board.description && <p className="muted">{board.description}</p>}
        </div>
        <div className="actions">
          <button
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => {
              const title = window.prompt('Board name', board.title);
              if (title?.trim()) void run(() => api.updateBoard(board._id, { title }, board.__v));
            }}
          >
            ✏️ Rename
          </button>
          <button
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => {
              const description = window.prompt('Board description', board.description);
              if (description !== null)
                void run(() => api.updateBoard(board._id, { description }, board.__v));
            }}
          >
            📝 Description
          </button>
          <button
            className="btn btn-danger btn-sm"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm('Delete this board and every column and card in it?')) return;
              const result = await run(async () => {
                await api.deleteBoard(board._id, board.__v);
                selectBoard(null);
                return true;
              });
              if (result) navigate('/boards');
            }}
          >
            🗑️ Delete
          </button>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-3)' }}>
        Drag a card by its handle, or use the Move to menu. Keyboard: Space to lift, arrows to move,
        Space to drop.
      </p>
      {busy && (
        <p role="status" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: 'var(--text-sm)', color: 'var(--color-primary-500)' }}>
          <span className="spinner spinner-sm" aria-hidden="true" />
          Saving changes…
        </p>
      )}
      <Kanban key={board._id} board={board} />
    </main>
  );
}
