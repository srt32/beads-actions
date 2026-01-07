import { execBeadsCommand, BeadsTask } from './beads';
import { Octokit } from '@octokit/rest';

/**
 * Get all tasks from Beads
 */
function getAllBeadsTasks(): BeadsTask[] {
  try {
    const output = execBeadsCommand('bd list', true);
    
    if (!output || output.trim() === '') {
      return [];
    }
    
    return JSON.parse(output);
  } catch (error) {
    console.error('Error fetching beads tasks:', error);
    return [];
  }
}

/**
 * Sync task status back to GitHub issue
 */
async function syncTaskToIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  task: BeadsTask
): Promise<void> {
  const issueNumber = task.metadata?.github_issue;
  
  if (!issueNumber) {
    console.log(`Task ${task.id} has no linked GitHub issue, skipping`);
    return;
  }

  try {
    // Get current issue state
    const { data: issue } = await octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber
    });

    console.log(`Task ${task.id} status: ${task.status}, Issue #${issueNumber} state: ${issue.state}`);

    // Sync status based on task state
    if (task.status === 'closed' || task.status === 'completed') {
      if (issue.state === 'open') {
        await octokit.issues.update({
          owner,
          repo,
          issue_number: issueNumber,
          state: 'closed',
          state_reason: 'completed'
        });
        console.log(`✓ Closed issue #${issueNumber} (task ${task.id} completed)`);
      } else {
        console.log(`  Issue #${issueNumber} already closed`);
      }
    } else if (task.status === 'open' || task.status === 'in_progress') {
      if (issue.state === 'closed') {
        await octokit.issues.update({
          owner,
          repo,
          issue_number: issueNumber,
          state: 'open'
        });
        console.log(`✓ Reopened issue #${issueNumber} (task ${task.id} reopened)`);
      } else {
        console.log(`  Issue #${issueNumber} already open`);
      }
    }
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status === 404) {
      console.warn(`Warning: Issue #${issueNumber} not found (may have been deleted)`);
    } else {
      console.error(`Error syncing task ${task.id} to issue #${issueNumber}:`, err.message);
    }
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;

  if (!token) {
    console.error('Error: GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  if (!repository) {
    console.error('Error: GITHUB_REPOSITORY environment variable is required');
    process.exit(1);
  }

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    console.error('Error: Invalid GITHUB_REPOSITORY format (expected: owner/repo)');
    process.exit(1);
  }

  console.log(`Syncing Beads tasks to GitHub issues in ${owner}/${repo}...`);

  const octokit = new Octokit({ auth: token });

  // Get all tasks that have GitHub issue metadata
  const tasks = getAllBeadsTasks();
  const tasksWithIssues = tasks.filter(task => task.metadata?.github_issue);

  console.log(`Found ${tasksWithIssues.length} tasks linked to GitHub issues`);

  // Sync each task to its corresponding issue
  for (const task of tasksWithIssues) {
    await syncTaskToIssue(octokit, owner, repo, task);
  }

  console.log('Sync completed successfully');
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { getAllBeadsTasks, syncTaskToIssue };
