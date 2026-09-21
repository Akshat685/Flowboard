import { Link, useNavigate } from 'react-router-dom';
import { boardsApi as api } from '@/features/boards/boards.api';
import { useBoards } from '@/features/boards/hooks/BoardContext';
import { TitleForm } from '@/components/common/TitleForm';

export function BoardsPage() {
  const { boards, page, pages, changePage, loadingList, busy, run } = useBoards();
  const navigate = useNavigate();

  return (
    <main id="main-content" tabIndex={-1} className="page">
      <p className="eyebrow">YOUR WORKSPACE</p>
      <h1>
        Make room for your <span className="gradient-text">next idea.</span>
      </h1>
      <p className="muted">Create a board, break things down, and keep moving.</p>

      <TitleForm
        label="Create board"
        busy={busy}
        onSubmit={async (title) => {
          const result = await run(() => api.createBoard({ title }));
          if (result) navigate(`/boards/${result.board._id}`);
          return result;
        }}
      />

      {loadingList ? (
        <div className="board-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-card" />
          ))}
        </div>
      ) : (
        <div className="board-grid">
          {boards.map((board) => (
            <Link className="board-tile" key={board._id} to={`/boards/${board._id}`}>
              <small>BOARD</small>
              <h2>{board.title}</h2>
              <p>{board.description || 'Open your board to get started'}</p>
              <span className="board-tile-cta">Open board →</span>
            </Link>
          ))}
          {boards.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              <h3>No boards yet</h3>
              <p>Your first board starts here. Give it a name above.</p>
            </div>
          )}
        </div>
      )}

      {pages > 1 && (
        <nav className="pagination" aria-label="Board pages">
          <button
            className="btn btn-secondary btn-sm"
            disabled={loadingList || page <= 1}
            onClick={() => changePage(page - 1)}
          >
            ← Previous
          </button>
          <span aria-live="polite">
            Page {page} of {pages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={loadingList || page >= pages}
            onClick={() => changePage(page + 1)}
          >
            Next →
          </button>
        </nav>
      )}
    </main>
  );
}
