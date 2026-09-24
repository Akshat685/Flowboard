/**
 * Determine the urgency status of a due date relative to the user's local time.
 * Returns null | 'overdue' | 'due-soon' | 'upcoming'.
 */
export function dueDateStatus(dueDate) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;

  // Compare using local calendar days so "today" matches the user's timezone.
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  if (startOfDueDay < startOfToday) return 'overdue';

  const msIn48h = 48 * 60 * 60 * 1000;
  if (startOfDueDay.getTime() - startOfToday.getTime() < msIn48h) return 'due-soon';

  return 'upcoming';
}

const shortMonths = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Return a human-readable label for a due-date badge.
 * Examples: "2 days overdue", "Due today", "Due tomorrow", "Due Oct 3".
 */
export function formatDueDate(dueDate) {
  if (!dueDate) return '';
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return '';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffMs = startOfDueDay.getTime() - startOfToday.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    const overdue = Math.abs(diffDays);
    return overdue === 1 ? '1 day overdue' : `${overdue} days overdue`;
  }
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  return `Due ${shortMonths[due.getMonth()]} ${due.getDate()}`;
}
