import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { boardsApi as api } from '../boards.api';
import { useBoards } from '../hooks/BoardContext';
import { CardComposer } from './CardComposer';
import { CardForm } from './CardForm';
import { TitleForm } from '@/components/common/TitleForm';
import { dueDateStatus, formatDueDate } from '@/utils/dates';

const priorityBadge = (priority) => {
  const map = {
    low: 'badge-low',
    medium: 'badge-medium',
    high: 'badge-high',
    urgent: 'badge-urgent',
  };
  return `badge ${map[priority] || 'badge-medium'}`;
};

const dueDateBadge = (status) => {
  const map = {
    overdue: 'badge-overdue',
    'due-soon': 'badge-due-soon',
    upcoming: 'badge-upcoming',
  };
  return `badge ${map[status] || ''}`;
};

function relativeTime(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function CardComments({ board, columnId, cardId, comments, run, busy }) {
  const [text, setText] = useState('');
  return (
    <div className="card-comments">
      <h4 className="card-comments-title">💬 Comments ({comments.length})</h4>
      {comments.length > 0 && (
        <ul className="comment-list">
          {comments.map((comment) => (
            <li key={comment._id} className="comment-item">
              <p className="comment-text">{comment.text}</p>
              <div className="comment-meta">
                <time className="comment-time" dateTime={comment.createdAt}>
                  {relativeTime(comment.createdAt)}
                </time>
                <button
                  className="btn btn-ghost btn-sm comment-delete"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Delete this comment?'))
                      void run(() =>
                        api.deleteComment(board._id, columnId, cardId, comment._id, board.__v),
                      );
                  }}
                >
                  🗑️
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form
        className="comment-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim() || busy) return;
          void run(() =>
            api.addComment(board._id, columnId, cardId, { text: text.trim() }, board.__v),
          );
          setText('');
        }}
      >
        <input
          className="comment-input"
          placeholder="Add a comment…"
          maxLength={1000}
          value={text}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
        />
        <button className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>
          Post
        </button>
      </form>
    </div>
  );
}

export function Kanban({ board: currentBoard }) {
  const { run, busy } = useBoards();
  const [editing, setEditing] = useState(null);
  const [dragBoard, setDragBoard] = useState(null);
  useEffect(() => {
    if (
      editing &&
      !currentBoard.columns.some((column) => column.cards.some((card) => card._id === editing.id))
    ) {
      setEditing(null);
    }
  }, [currentBoard, editing]);
  // Keep the drag layout and expected version stable until drop/cancel.
  const board = dragBoard || currentBoard;
  const move = (cardId, sourceColumnId, targetColumnId, targetIndex) =>
    run(() =>
      api.moveCard(board._id, cardId, { sourceColumnId, targetColumnId, targetIndex }, board.__v),
    );
  return (
    <DragDropContext
      onBeforeCapture={() => setDragBoard(currentBoard)}
      onDragEnd={({ draggableId, source, destination }) => {
        setDragBoard(null);
        if (
          !destination ||
          busy ||
          (source.droppableId === destination.droppableId && source.index === destination.index)
        )
          return;
        void move(draggableId, source.droppableId, destination.droppableId, destination.index);
      }}
    >
      <div className="kanban" aria-label="Board columns">
        {board.columns.map((column) => (
          <section className="column" key={column._id}>
            <header className="column-header">
              <h2>
                {column.title} <span>{column.cards.length}</span>
              </h2>
              <div className="actions">
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => {
                    const title = window.prompt('Column name', column.title);
                    if (title?.trim())
                      void run(() => api.updateColumn(board._id, column._id, { title }, board.__v));
                  }}
                >
                  ✏️
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Delete ${column.title} and all its cards?`))
                      void run(() => api.deleteColumn(board._id, column._id, board.__v));
                  }}
                >
                  🗑️
                </button>
              </div>
            </header>
            <Droppable droppableId={column._id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`card-list ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
                >
                  {column.cards.map((card, index) => (
                    <Draggable
                      key={card._id}
                      draggableId={card._id}
                      index={index}
                      isDragDisabled={editing !== null}
                      disableInteractiveElementBlocking
                    >
                      {(drag) => (
                        <article className="task-card" ref={drag.innerRef} {...drag.draggableProps}>
                          {/* Keep handle attributes during save so the drag library can restore focus. */}
                          <button
                            className="drag-handle"
                            disabled={busy}
                            {...drag.dragHandleProps}
                            aria-label={`Drag ${card.title}`}
                          >
                            ⠿ Drag
                          </button>
                          {editing?.id === card._id ? (
                            <>
                              <CardForm
                                card={editing.card}
                                stale={editing.version !== currentBoard.__v}
                                busy={busy}
                                onCancel={() => setEditing(null)}
                                onSubmit={(input) =>
                                  run(() =>
                                    api.updateCard(
                                      board._id,
                                      column._id,
                                      card._id,
                                      input,
                                      editing.version,
                                    ),
                                  )
                                }
                              />
                              <CardComments
                                board={currentBoard}
                                columnId={column._id}
                                cardId={card._id}
                                comments={card.comments || []}
                                run={run}
                                busy={busy}
                              />
                            </>
                          ) : (
                            <>
                              <h3>{card.title}</h3>
                              {card.description && (
                                <p className="description">{card.description}</p>
                              )}
                              <div className="metadata">
                                <span className={priorityBadge(card.priority)}>
                                  {card.priority}
                                </span>
                                {(() => {
                                  const status = dueDateStatus(card.dueDate);
                                  return status ? (
                                    <time
                                      className={dueDateBadge(status)}
                                      dateTime={card.dueDate}
                                      data-due-status={status}
                                    >
                                      📅 {formatDueDate(card.dueDate)}
                                    </time>
                                  ) : null;
                                })()}
                                {card.labels.map((label, i) => (
                                  <span className="badge badge-label" key={`${label}-${i}`}>
                                    {label}
                                  </span>
                                ))}
                                {card.comments?.length > 0 && (
                                  <span className="badge badge-label">
                                    💬 {card.comments.length}
                                  </span>
                                )}
                              </div>
                              <div className="actions">
                                <button
                                  className="btn btn-ghost btn-sm"
                                  disabled={busy}
                                  onClick={() =>
                                    setEditing({ id: card._id, card, version: board.__v })
                                  }
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  disabled={busy}
                                  onClick={() => {
                                    if (window.confirm(`Delete ${card.title}?`))
                                      void run(() =>
                                        api.deleteCard(board._id, column._id, card._id, board.__v),
                                      );
                                  }}
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                              <label className="move-select">
                                Move to
                                <select
                                  aria-label={`Move ${card.title} to column`}
                                  disabled={busy}
                                  value={column._id}
                                  onChange={(event) => {
                                    const target = board.columns.find(
                                      (value) => value._id === event.target.value,
                                    );
                                    if (target)
                                      void move(
                                        card._id,
                                        column._id,
                                        target._id,
                                        target.cards.length,
                                      );
                                  }}
                                >
                                  {board.columns.map((value) => (
                                    <option key={value._id} value={value._id}>
                                      {value.title}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </>
                          )}
                        </article>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
            <CardComposer
              columnTitle={column.title}
              busy={busy}
              onSubmit={(input) =>
                run(() => api.createCard(board._id, column._id, input, board.__v))
              }
            />
          </section>
        ))}
        <section className="column new-column">
          <h2>New column</h2>
          <TitleForm
            label="Add column"
            maxLength={80}
            busy={busy}
            onSubmit={(title) => run(() => api.createColumn(board._id, { title }, board.__v))}
          />
        </section>
      </div>
    </DragDropContext>
  );
}
