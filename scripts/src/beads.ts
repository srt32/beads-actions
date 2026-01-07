import { execSync } from 'child_process';

export interface BeadsTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: number;
  labels?: string[];
  metadata?: Record<string, any>;
}

/**
 * Escape a string for safe use in shell commands
 * Wraps the string in single quotes and escapes any single quotes within
 */
export function escapeShellArg(arg: string): string {
  // Replace single quotes with '\'' (end quote, escaped quote, start quote)
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

/**
 * Execute a beads command and return the output
 */
export function execBeadsCommand(command: string, returnJson = false): string {
  try {
    const fullCommand = returnJson ? `${command} --format json` : command;
    const output = execSync(fullCommand, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return output.trim();
  } catch (error: any) {
    console.error(`Error executing beads command: ${command}`);
    console.error(error.stderr || error.message);
    throw error;
  }
}

/**
 * Find a beads task by GitHub issue number
 */
export function findTaskByIssueNumber(issueNumber: number): string | null {
  try {
    const output = execBeadsCommand('bd list', true);
    if (!output) return null;

    const tasks = JSON.parse(output);
    for (const task of tasks) {
      if (task.metadata?.github_issue === issueNumber) {
        return task.id;
      }
    }
    return null;
  } catch (error) {
    console.error('Error finding task:', error);
    return null;
  }
}

/**
 * Create a new beads task from a GitHub issue
 */
export function createTask(
  issueNumber: number,
  title: string,
  body: string,
  labels: string[],
  url: string
): string {
  // Determine priority from labels
  let priority = 2; // Default to P2
  if (labels.some(l => l.toLowerCase().includes('p0') || l.toLowerCase().includes('critical'))) {
    priority = 0;
  } else if (labels.some(l => l.toLowerCase().includes('p1') || l.toLowerCase().includes('high'))) {
    priority = 1;
  } else if (labels.some(l => l.toLowerCase().includes('p3') || l.toLowerCase().includes('low'))) {
    priority = 3;
  }

  // Create the task
  const createCommand = `bd create ${escapeShellArg(title)} -p ${priority}`;
  const output = execBeadsCommand(createCommand);
  
  // Extract task ID from output (format: "Created task bd-xxxx")
  const match = output.match(/bd-[a-f0-9]+/);
  if (!match) {
    throw new Error('Failed to extract task ID from beads output');
  }
  const taskId = match[0];

  // Update task with description and metadata
  if (body) {
    execBeadsCommand(`bd update ${taskId} --description ${escapeShellArg(body)}`);
  }

  // Add labels
  for (const label of labels) {
    try {
      execBeadsCommand(`bd update ${taskId} --add-label ${escapeShellArg(label)}`);
    } catch (error) {
      console.warn(`Warning: Could not add label ${label}`);
    }
  }

  // Store GitHub metadata
  try {
    execBeadsCommand(`bd update ${taskId} --set-metadata github_issue=${issueNumber}`);
    execBeadsCommand(`bd update ${taskId} --set-metadata github_url=${escapeShellArg(url)}`);
  } catch (error) {
    console.warn('Warning: Could not set metadata');
  }

  return taskId;
}

/**
 * Update an existing beads task
 * Note: Labels are additive only. This implementation does not remove labels that
 * were removed from the GitHub issue. This is a known limitation to keep the sync
 * logic simple and avoid accidentally removing manually added labels in Beads.
 */
export function updateTask(
  taskId: string,
  title: string,
  body: string,
  labels: string[]
): void {
  // Update title
  execBeadsCommand(`bd update ${taskId} --title ${escapeShellArg(title)}`);

  // Update description
  if (body) {
    execBeadsCommand(`bd update ${taskId} --description ${escapeShellArg(body)}`);
  }

  // Sync labels - additive only (does not remove labels)
  for (const label of labels) {
    try {
      execBeadsCommand(`bd update ${taskId} --add-label ${escapeShellArg(label)}`);
    } catch (error) {
      console.warn(`Warning: Could not add label ${label}`);
    }
  }
}

/**
 * Close a beads task
 */
export function closeTask(taskId: string): void {
  execBeadsCommand(`bd close ${taskId}`);
}

/**
 * Reopen a beads task
 */
export function reopenTask(taskId: string): void {
  execBeadsCommand(`bd update ${taskId} --status open`);
}

/**
 * Delete a beads task (mark as deleted/cancelled)
 */
export function deleteTask(taskId: string): void {
  // Beads doesn't have a delete command, so we close it with a special label
  try {
    execBeadsCommand(`bd update ${taskId} --add-label ${escapeShellArg('deleted')}`);
    execBeadsCommand(`bd close ${taskId}`);
  } catch (error) {
    console.warn('Warning: Could not mark task as deleted');
  }
}
