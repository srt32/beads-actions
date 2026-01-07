import {
  createTask,
  updateTask,
  closeTask,
  reopenTask,
  deleteTask,
  findTaskByIssueNumber
} from './beads';

interface GitHubLabel {
  name: string;
  color?: string;
}

interface IssueEvent {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: GitHubLabel[];
  action: 'opened' | 'edited' | 'closed' | 'reopened' | 'deleted';
  url: string;
}

/**
 * Parse environment variables into an IssueEvent
 */
function parseIssueFromEnv(): IssueEvent {
  const issueNumber = parseInt(process.env.ISSUE_NUMBER || '0', 10);
  const title = process.env.ISSUE_TITLE || '';
  const body = process.env.ISSUE_BODY || '';
  const state = (process.env.ISSUE_STATE || 'open') as 'open' | 'closed';
  const action = (process.env.ACTION || 'opened') as IssueEvent['action'];
  const url = process.env.ISSUE_URL || '';

  let labels: GitHubLabel[] = [];
  try {
    const labelsJson = process.env.ISSUE_LABELS || '[]';
    labels = JSON.parse(labelsJson);
  } catch (error) {
    console.warn('Could not parse labels, using empty array');
  }

  if (!issueNumber || !title) {
    throw new Error('Missing required environment variables: ISSUE_NUMBER, ISSUE_TITLE');
  }

  return {
    number: issueNumber,
    title,
    body,
    state,
    labels,
    action,
    url
  };
}

/**
 * Sync a GitHub issue to beads based on the action
 */
export async function syncIssue(event: IssueEvent): Promise<void> {
  console.log(`Processing ${event.action} action for issue #${event.number}: ${event.title}`);

  const existingTaskId = findTaskByIssueNumber(event.number);
  const labelNames = event.labels.map(l => l.name);

  switch (event.action) {
    case 'opened':
      if (existingTaskId) {
        console.log(`Task already exists: ${existingTaskId}`);
        // Update in case of race condition or manual creation
        updateTask(existingTaskId, event.title, event.body, labelNames);
      } else {
        const taskId = createTask(event.number, event.title, event.body, labelNames, event.url);
        console.log(`Created new task: ${taskId}`);
      }
      break;

    case 'edited':
      if (existingTaskId) {
        updateTask(existingTaskId, event.title, event.body, labelNames);
        console.log(`Updated task: ${existingTaskId}`);
      } else {
        // Issue was edited but no task exists - create one
        const taskId = createTask(event.number, event.title, event.body, labelNames, event.url);
        console.log(`Created new task (edited): ${taskId}`);
      }
      break;

    case 'closed':
      if (existingTaskId) {
        closeTask(existingTaskId);
        console.log(`Closed task: ${existingTaskId}`);
      } else {
        console.log(`No task found for issue #${event.number}, skipping close`);
      }
      break;

    case 'reopened':
      if (existingTaskId) {
        reopenTask(existingTaskId);
        console.log(`Reopened task: ${existingTaskId}`);
      } else {
        // Issue was reopened but no task exists - create one
        const taskId = createTask(event.number, event.title, event.body, labelNames, event.url);
        console.log(`Created new task (reopened): ${taskId}`);
      }
      break;

    case 'deleted':
      if (existingTaskId) {
        deleteTask(existingTaskId);
        console.log(`Deleted task: ${existingTaskId}`);
      } else {
        console.log(`No task found for issue #${event.number}, skipping delete`);
      }
      break;

    default:
      console.log(`Unknown action: ${event.action}, skipping`);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const event = parseIssueFromEnv();
    await syncIssue(event);
    console.log('Sync completed successfully');
  } catch (error) {
    console.error('Error syncing issue:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { parseIssueFromEnv };
