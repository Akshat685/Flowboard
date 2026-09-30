export const priorities = ['low', 'medium', 'high', 'urgent'];

export const boardTemplates = [
  { id: 'kanban', label: 'Basic Kanban', columns: ['To do', 'In progress', 'Done'] },
  {
    id: 'sprint',
    label: 'Sprint Board',
    columns: ['Backlog', 'This Sprint', 'In Review', 'Done'],
  },
  {
    id: 'content',
    label: 'Content Pipeline',
    columns: ['Ideas', 'Writing', 'Editing', 'Published'],
  },
  { id: 'bugs', label: 'Bug Tracker', columns: ['Reported', 'Triaged', 'Fixing', 'Verified'] },
];

export const templateIds = boardTemplates.map((t) => t.id);
