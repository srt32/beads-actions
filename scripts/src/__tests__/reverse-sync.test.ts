import { getAllBeadsTasks, syncTaskToIssue } from '../reverse-sync';
import { execSync } from 'child_process';
import { Octokit } from '@octokit/rest';

// Mock dependencies
jest.mock('child_process');
jest.mock('@octokit/rest');

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;
const MockedOctokit = Octokit as jest.MockedClass<typeof Octokit>;

describe('reverse-sync', () => {
  let mockOctokit: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock Octokit instance
    mockOctokit = {
      issues: {
        get: jest.fn(),
        update: jest.fn()
      }
    };
    MockedOctokit.mockImplementation(() => mockOctokit);
  });

  describe('getAllBeadsTasks', () => {
    it('should return parsed tasks from beads', () => {
      const mockTasks = [
        { id: 'bd-1234', status: 'open', metadata: { github_issue: 42 } },
        { id: 'bd-5678', status: 'closed', metadata: { github_issue: 43 } }
      ];
      mockedExecSync.mockReturnValue(JSON.stringify(mockTasks));

      const tasks = getAllBeadsTasks();

      expect(tasks).toEqual(mockTasks);
      expect(mockedExecSync).toHaveBeenCalledWith(
        'bd list --format json',
        expect.any(Object)
      );
    });

    it('should return empty array on error', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      const tasks = getAllBeadsTasks();

      expect(tasks).toEqual([]);
    });

    it('should return empty array for empty output', () => {
      mockedExecSync.mockReturnValue('');

      const tasks = getAllBeadsTasks();

      expect(tasks).toEqual([]);
    });
  });

  describe('syncTaskToIssue', () => {
    const owner = 'test-owner';
    const repo = 'test-repo';

    it('should skip tasks without github_issue metadata', async () => {
      const task = { id: 'bd-1234', status: 'open' };

      await syncTaskToIssue(mockOctokit, owner, repo, task);

      expect(mockOctokit.issues.get).not.toHaveBeenCalled();
      expect(mockOctokit.issues.update).not.toHaveBeenCalled();
    });

    it('should close open GitHub issue when task is completed', async () => {
      const task = {
        id: 'bd-1234',
        status: 'completed',
        metadata: { github_issue: 42 }
      };

      mockOctokit.issues.get.mockResolvedValue({
        data: { state: 'open', number: 42 }
      });

      await syncTaskToIssue(mockOctokit, owner, repo, task);

      expect(mockOctokit.issues.get).toHaveBeenCalledWith({
        owner,
        repo,
        issue_number: 42
      });
      expect(mockOctokit.issues.update).toHaveBeenCalledWith({
        owner,
        repo,
        issue_number: 42,
        state: 'closed',
        state_reason: 'completed'
      });
    });

    it('should close open GitHub issue when task is closed', async () => {
      const task = {
        id: 'bd-1234',
        status: 'closed',
        metadata: { github_issue: 42 }
      };

      mockOctokit.issues.get.mockResolvedValue({
        data: { state: 'open', number: 42 }
      });

      await syncTaskToIssue(mockOctokit, owner, repo, task);

      expect(mockOctokit.issues.update).toHaveBeenCalledWith({
        owner,
        repo,
        issue_number: 42,
        state: 'closed',
        state_reason: 'completed'
      });
    });

    it('should reopen closed GitHub issue when task is open', async () => {
      const task = {
        id: 'bd-1234',
        status: 'open',
        metadata: { github_issue: 42 }
      };

      mockOctokit.issues.get.mockResolvedValue({
        data: { state: 'closed', number: 42 }
      });

      await syncTaskToIssue(mockOctokit, owner, repo, task);

      expect(mockOctokit.issues.update).toHaveBeenCalledWith({
        owner,
        repo,
        issue_number: 42,
        state: 'open'
      });
    });

    it('should reopen closed GitHub issue when task is in_progress', async () => {
      const task = {
        id: 'bd-1234',
        status: 'in_progress',
        metadata: { github_issue: 42 }
      };

      mockOctokit.issues.get.mockResolvedValue({
        data: { state: 'closed', number: 42 }
      });

      await syncTaskToIssue(mockOctokit, owner, repo, task);

      expect(mockOctokit.issues.update).toHaveBeenCalledWith({
        owner,
        repo,
        issue_number: 42,
        state: 'open'
      });
    });

    it('should not update issue if already in correct state', async () => {
      const task = {
        id: 'bd-1234',
        status: 'closed',
        metadata: { github_issue: 42 }
      };

      mockOctokit.issues.get.mockResolvedValue({
        data: { state: 'closed', number: 42 }
      });

      await syncTaskToIssue(mockOctokit, owner, repo, task);

      expect(mockOctokit.issues.update).not.toHaveBeenCalled();
    });

    it('should handle 404 error gracefully when issue not found', async () => {
      const task = {
        id: 'bd-1234',
        status: 'closed',
        metadata: { github_issue: 999 }
      };

      mockOctokit.issues.get.mockRejectedValue({
        status: 404,
        message: 'Not Found'
      });

      // Should not throw
      await expect(
        syncTaskToIssue(mockOctokit, owner, repo, task)
      ).resolves.not.toThrow();
    });

    it('should handle other errors gracefully', async () => {
      const task = {
        id: 'bd-1234',
        status: 'closed',
        metadata: { github_issue: 42 }
      };

      mockOctokit.issues.get.mockRejectedValue({
        status: 500,
        message: 'Internal Server Error'
      });

      // Should not throw
      await expect(
        syncTaskToIssue(mockOctokit, owner, repo, task)
      ).resolves.not.toThrow();
    });
  });
});
