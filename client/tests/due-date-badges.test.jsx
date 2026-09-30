import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { boardsApi as api } from '@/features/boards/boards.api';
import { Kanban } from '@/features/boards/components/Kanban';
import { BoardProvider } from '@/features/boards/hooks/BoardContext';
import { dueDateStatus, formatDueDate } from '@/utils/dates';

vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), disconnect: vi.fn() }) }));

// All date-dependent tests pin "now" to 2026-09-24 12:00 local time.
const FIXED_NOW = new Date(2026, 8, 24, 12, 0, 0);

function makeBoard(cards) {
  return {
    _id: '507f1f77bcf86cd799439012',
    title: 'Test',
    description: '',
    owner: '507f1f77bcf86cd799439011',
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-09-15T00:00:00.000Z',
    __v: 0,
    columns: [
      {
        _id: '507f1f77bcf86cd799439013',
        title: 'To do',
        createdAt: '2026-09-15T00:00:00.000Z',
        updatedAt: '2026-09-15T00:00:00.000Z',
        cards,
      },
    ],
  };
}

function makeCard(overrides = {}) {
  return {
    _id: '507f1f77bcf86cd799439020',
    title: 'Test card',
    description: '',
    priority: 'medium',
    dueDate: null,
    labels: [],
    comments: [],
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-09-15T00:00:00.000Z',
    ...overrides,
  };
}

function renderBoard(board) {
  vi.spyOn(api, 'boards').mockResolvedValue({ boards: [board] });
  render(
    <BoardProvider>
      <Kanban board={board} />
    </BoardProvider>,
  );
}

// ─── Unit tests for dueDateStatus ─────────────────────────────────
describe('dueDateStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXED_NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for a falsy due date', () => {
    expect(dueDateStatus(null)).toBeNull();
    expect(dueDateStatus(undefined)).toBeNull();
    expect(dueDateStatus('')).toBeNull();
  });

  it('returns "overdue" for a past date', () => {
    expect(dueDateStatus('2026-09-20T00:00:00.000Z')).toBe('overdue');
  });

  it('returns "due-soon" for a date within the next 48 hours', () => {
    // Tomorrow (Sep 25) is within 48h of Sep 24
    expect(dueDateStatus('2026-09-25T00:00:00.000Z')).toBe('due-soon');
  });

  it('returns "due-soon" for today', () => {
    expect(dueDateStatus('2026-09-24T00:00:00.000Z')).toBe('due-soon');
  });

  it('returns "upcoming" for a date more than 48 hours out', () => {
    // Sep 30 is well beyond 48h
    expect(dueDateStatus('2026-09-30T00:00:00.000Z')).toBe('upcoming');
  });
});

// ─── Unit tests for formatDueDate ─────────────────────────────────
describe('formatDueDate', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXED_NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty string for null', () => {
    expect(formatDueDate(null)).toBe('');
  });

  it('returns "X days overdue" for past dates', () => {
    expect(formatDueDate('2026-09-21T00:00:00.000Z')).toBe('3 days overdue');
  });

  it('returns "1 day overdue" for yesterday', () => {
    expect(formatDueDate('2026-09-23T00:00:00.000Z')).toBe('1 day overdue');
  });

  it('returns "Due today" for today', () => {
    expect(formatDueDate('2026-09-24T00:00:00.000Z')).toBe('Due today');
  });

  it('returns "Due tomorrow" for the next day', () => {
    expect(formatDueDate('2026-09-25T00:00:00.000Z')).toBe('Due tomorrow');
  });

  it('returns "Due Mon D" for a further-out date', () => {
    expect(formatDueDate('2026-10-03T00:00:00.000Z')).toBe('Due Oct 3');
  });
});

// ─── Integration tests: badge rendering in Kanban ─────────────────
describe('due date badges on cards', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXED_NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows an overdue badge with "overdue" styling for a past due date', () => {
    const card = makeCard({ dueDate: '2026-09-20T00:00:00.000Z' });
    renderBoard(makeBoard([card]));
    const badge = screen.getByText(/overdue/i);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-due-status', 'overdue');
    expect(badge.className).toContain('badge-overdue');
  });

  it('does not show an urgent due badge for a card due >48 hours out', () => {
    const card = makeCard({ dueDate: '2026-10-15T00:00:00.000Z' });
    renderBoard(makeBoard([card]));
    // The "upcoming" badge should show, but not "overdue" or "due-soon"
    const badges = screen.queryAllByText(/overdue|Due today|Due tomorrow/i);
    expect(badges).toHaveLength(0);
    // Verify the upcoming badge is present
    const upcoming = screen.getByText(/Due Oct 15/);
    expect(upcoming).toHaveAttribute('data-due-status', 'upcoming');
    expect(upcoming.className).toContain('badge-upcoming');
  });

  it('shows nothing for a card with no due date', () => {
    const card = makeCard({ dueDate: null });
    renderBoard(makeBoard([card]));
    const timeBadges = document.querySelectorAll('time[data-due-status]');
    expect(timeBadges).toHaveLength(0);
  });

  it('shows "Due today" for a card due today', () => {
    const card = makeCard({ dueDate: '2026-09-24T00:00:00.000Z' });
    renderBoard(makeBoard([card]));
    const badge = screen.getByText(/Due today/);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-due-status', 'due-soon');
    expect(badge.className).toContain('badge-due-soon');
  });
});
