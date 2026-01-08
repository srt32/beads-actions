import {
  execBeadsCommand,
  findTaskByIssueNumber,
  createTask,
  updateTask,
  closeTask,
  reopenTask,
  deleteTask,
  escapeShellArg
} from '../beads';
import { execSync } from 'child_process';

// Mock child_process
jest.mock('child_process');
const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('beads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('escapeShellArg', () => {
    it('should wrap string in single quotes', () => {
      expect(escapeShellArg('hello')).toBe("'hello'");
    });

    it('should escape single quotes', () => {
      expect(escapeShellArg("it's")).toBe("'it'\\''s'");
    });

    it('should handle multiple single quotes', () => {
      expect(escapeShellArg("it's a test's")).toBe("'it'\\''s a test'\\''s'");
    });

    it('should handle empty string', () => {
      expect(escapeShellArg('')).toBe("''");
    });

    it('should not escape double quotes', () => {
      expect(escapeShellArg('say "hello"')).toBe("'say \"hello\"'");
    });

    it('should handle special characters', () => {
      expect(escapeShellArg('test$var')).toBe("'test$var'");
      expect(escapeShellArg('test`cmd`')).toBe("'test`cmd`'");
    });
  });

  describe('execBeadsCommand', () => {
    it('should execute command without JSON format', () => {
      mockedExecSync.mockReturnValue('Success');
      const result = execBeadsCommand('bd list');
      expect(result).toBe('Success');
      expect(mockedExecSync).toHaveBeenCalledWith('bd list', expect.any(Object));
    });

    it('should execute command with JSON format', () => {
      mockedExecSync.mockReturnValue('{"tasks": []}');
      const result = execBeadsCommand('bd list', true);
      expect(result).toBe('{"tasks": []}');
      expect(mockedExecSync).toHaveBeenCalledWith('bd list --format json', expect.any(Object));
    });

    it('should throw error on command failure', () => {
      mockedExecSync.mockImplementation(() => {
        const error: any = new Error('Command failed');
        error.stderr = 'Error details';
        throw error;
      });
      expect(() => execBeadsCommand('bd invalid')).toThrow();
    });
  });

  describe('findTaskByIssueNumber', () => {
    it('should find task by issue number', () => {
      const mockTasks = JSON.stringify([
        { id: 'bd-1234', metadata: { github_issue: 42 } },
        { id: 'bd-5678', metadata: { github_issue: 43 } }
      ]);
      mockedExecSync.mockReturnValue(mockTasks);

      const result = findTaskByIssueNumber(42);
      expect(result).toBe('bd-1234');
    });

    it('should return null if task not found', () => {
      const mockTasks = JSON.stringify([
        { id: 'bd-1234', metadata: { github_issue: 42 } }
      ]);
      mockedExecSync.mockReturnValue(mockTasks);

      const result = findTaskByIssueNumber(999);
      expect(result).toBeNull();
    });

    it('should return null on error', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      const result = findTaskByIssueNumber(42);
      expect(result).toBeNull();
    });

    it('should handle tasks without metadata', () => {
      const mockTasks = JSON.stringify([
        { id: 'bd-1234' },
        { id: 'bd-5678', metadata: {} }
      ]);
      mockedExecSync.mockReturnValue(mockTasks);

      const result = findTaskByIssueNumber(42);
      expect(result).toBeNull();
    });
  });

  describe('createTask', () => {
    it('should create task with all parameters', () => {
      mockedExecSync
        .mockReturnValueOnce('Created task bd-abcd')  // create
        .mockReturnValueOnce('')  // update description
        .mockReturnValueOnce('')  // add label
        .mockReturnValueOnce('')  // add label
        .mockReturnValueOnce('')  // set metadata issue
        .mockReturnValueOnce(''); // set metadata url

      const taskId = createTask(
        42,
        'Test Issue',
        'Test description',
        ['bug', 'enhancement'],
        'https://github.com/test/repo/issues/42'
      );

      expect(taskId).toBe('bd-abcd');
      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining("bd create 'Test Issue' -p 2"),
        expect.any(Object)
      );
    });

    it('should set P0 priority for critical issues', () => {
      mockedExecSync
        .mockReturnValueOnce('Created task bd-abcd')
        .mockReturnValue('');

      createTask(42, 'Critical Bug', 'desc', ['p0', 'bug'], 'url');

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining('-p 0'),
        expect.any(Object)
      );
    });

    it('should set P1 priority for high priority issues', () => {
      mockedExecSync
        .mockReturnValueOnce('Created task bd-abcd')
        .mockReturnValue('');

      createTask(42, 'High Priority', 'desc', ['p1', 'high'], 'url');

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining('-p 1'),
        expect.any(Object)
      );
    });

    it('should handle empty body', () => {
      mockedExecSync
        .mockReturnValueOnce('Created task bd-abcd')
        .mockReturnValue('');

      const taskId = createTask(42, 'Test', '', [], 'url');

      expect(taskId).toBe('bd-abcd');
      // Should not call update for description when body is empty
      const calls = mockedExecSync.mock.calls;
      const hasDescriptionUpdate = calls.some(call => 
        call[0].toString().includes('--description')
      );
      expect(hasDescriptionUpdate).toBe(false);
    });

    it('should escape quotes in title', () => {
      mockedExecSync
        .mockReturnValueOnce('Created task bd-abcd')
        .mockReturnValue('');

      createTask(42, "Test 'quoted' title", 'desc', [], 'url');

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining("'Test '\\''quoted'\\'' title'"),
        expect.any(Object)
      );
    });

    it('should throw error if task ID cannot be extracted', () => {
      mockedExecSync.mockReturnValue('Invalid output');

      expect(() => createTask(42, 'Test', 'desc', [], 'url')).toThrow(
        'Failed to extract task ID from beads output'
      );
    });
  });

  describe('updateTask', () => {
    it('should update task title and description', () => {
      mockedExecSync.mockReturnValue('');

      updateTask('bd-1234', 'New Title', 'New description', ['bug']);

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining("bd update bd-1234 --title 'New Title'"),
        expect.any(Object)
      );
      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--description'),
        expect.any(Object)
      );
    });

    it('should handle empty body', () => {
      mockedExecSync.mockReturnValue('');

      updateTask('bd-1234', 'New Title', '', []);

      const calls = mockedExecSync.mock.calls;
      const hasDescriptionUpdate = calls.some(call => 
        call[0].toString().includes('--description')
      );
      // Should not update description when body is empty
      expect(hasDescriptionUpdate).toBe(false);
    });
  });

  describe('closeTask', () => {
    it('should close task', () => {
      mockedExecSync.mockReturnValue('');

      closeTask('bd-1234');

      expect(mockedExecSync).toHaveBeenCalledWith(
        'bd close bd-1234',
        expect.any(Object)
      );
    });
  });

  describe('reopenTask', () => {
    it('should reopen task', () => {
      mockedExecSync.mockReturnValue('');

      reopenTask('bd-1234');

      expect(mockedExecSync).toHaveBeenCalledWith(
        'bd update bd-1234 --status open',
        expect.any(Object)
      );
    });
  });

  describe('deleteTask', () => {
    it('should mark task as deleted and close it', () => {
      mockedExecSync.mockReturnValue('');

      deleteTask('bd-1234');

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining("--add-label 'github-deleted'"),
        expect.any(Object)
      );
      expect(mockedExecSync).toHaveBeenCalledWith(
        'bd close bd-1234',
        expect.any(Object)
      );
    });

    it('should not throw if commands fail', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      // Should not throw
      expect(() => deleteTask('bd-1234')).not.toThrow();
    });
  });
});
