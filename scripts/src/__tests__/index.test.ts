import { syncIssue, parseIssueFromEnv } from '../index';
import * as beads from '../beads';

// Mock beads module
jest.mock('../beads');
const mockedBeads = beads as jest.Mocked<typeof beads>;

describe('index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.ISSUE_NUMBER;
    delete process.env.ISSUE_TITLE;
    delete process.env.ISSUE_BODY;
    delete process.env.ISSUE_STATE;
    delete process.env.ISSUE_LABELS;
    delete process.env.ACTION;
    delete process.env.ISSUE_URL;
  });

  describe('parseIssueFromEnv', () => {
    it('should parse issue from environment variables', () => {
      process.env.ISSUE_NUMBER = '42';
      process.env.ISSUE_TITLE = 'Test Issue';
      process.env.ISSUE_BODY = 'Test body';
      process.env.ISSUE_STATE = 'open';
      process.env.ACTION = 'opened';
      process.env.ISSUE_URL = 'https://github.com/test/repo/issues/42';
      process.env.ISSUE_LABELS = JSON.stringify([
        { name: 'bug', color: 'red' },
        { name: 'enhancement', color: 'blue' }
      ]);

      const event = parseIssueFromEnv();

      expect(event).toEqual({
        number: 42,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        action: 'opened',
        url: 'https://github.com/test/repo/issues/42',
        labels: [
          { name: 'bug', color: 'red' },
          { name: 'enhancement', color: 'blue' }
        ]
      });
    });

    it('should handle missing optional fields', () => {
      process.env.ISSUE_NUMBER = '42';
      process.env.ISSUE_TITLE = 'Test Issue';

      const event = parseIssueFromEnv();

      expect(event.number).toBe(42);
      expect(event.title).toBe('Test Issue');
      expect(event.body).toBe('');
      expect(event.state).toBe('open');
      expect(event.action).toBe('opened');
      expect(event.labels).toEqual([]);
    });

    it('should throw error if required fields are missing', () => {
      expect(() => parseIssueFromEnv()).toThrow('Missing required environment variables');
    });

    it('should handle invalid labels JSON', () => {
      process.env.ISSUE_NUMBER = '42';
      process.env.ISSUE_TITLE = 'Test Issue';
      process.env.ISSUE_LABELS = 'invalid json';

      const event = parseIssueFromEnv();
      expect(event.labels).toEqual([]);
    });
  });

  describe('syncIssue', () => {
    const baseEvent = {
      number: 42,
      title: 'Test Issue',
      body: 'Test body',
      state: 'open' as const,
      labels: [{ name: 'bug' }],
      url: 'https://github.com/test/repo/issues/42',
      action: 'opened' as const
    };

    describe('opened action', () => {
      it('should create new task when issue is opened', async () => {
        mockedBeads.findTaskByIssueNumber.mockReturnValue(null);
        mockedBeads.createTask.mockReturnValue('bd-1234');

        await syncIssue(baseEvent);

        expect(mockedBeads.findTaskByIssueNumber).toHaveBeenCalledWith(42);
        expect(mockedBeads.createTask).toHaveBeenCalledWith(
          42,
          'Test Issue',
          'Test body',
          ['bug'],
          'https://github.com/test/repo/issues/42'
        );
      });

      it('should update existing task if found', async () => {
        mockedBeads.findTaskByIssueNumber.mockReturnValue('bd-1234');

        await syncIssue(baseEvent);

        expect(mockedBeads.updateTask).toHaveBeenCalledWith(
          'bd-1234',
          'Test Issue',
          'Test body',
          ['bug']
        );
        expect(mockedBeads.createTask).not.toHaveBeenCalled();
      });
    });

    describe('edited action', () => {
      it('should update existing task', async () => {
        mockedBeads.findTaskByIssueNumber.mockReturnValue('bd-1234');

        await syncIssue({ ...baseEvent, action: 'edited' });

        expect(mockedBeads.updateTask).toHaveBeenCalledWith(
          'bd-1234',
          'Test Issue',
          'Test body',
          ['bug']
        );
      });

      it('should create task if not found', async () => {
        mockedBeads.findTaskByIssueNumber.mockReturnValue(null);
        mockedBeads.createTask.mockReturnValue('bd-1234');

        await syncIssue({ ...baseEvent, action: 'edited' });

        expect(mockedBeads.createTask).toHaveBeenCalled();
      });
    });

    describe('closed action', () => {
      it('should close existing task', async () => {
        mockedBeads.findTaskByIssueNumber.mockReturnValue('bd-1234');

        await syncIssue({ ...baseEvent, action: 'closed', state: 'closed' });

        expect(mockedBeads.closeTask).toHaveBeenCalledWith('bd-1234');
      });

      it('should skip if task not found', async () => {
        mockedBeads.findTaskByIssueNumber.mockReturnValue(null);

        await syncIssue({ ...baseEvent, action: 'closed', state: 'closed' });

        expect(mockedBeads.closeTask).not.toHaveBeenCalled();
      });
    });

    describe('reopened action', () => {
      it('should reopen existing task', async () => {
        mockedBeads.findTaskByIssueNumber.mockReturnValue('bd-1234');

        await syncIssue({ ...baseEvent, action: 'reopened' });

        expect(mockedBeads.reopenTask).toHaveBeenCalledWith('bd-1234');
      });

      it('should create task if not found', async () => {
        mockedBeads.findTaskByIssueNumber.mockReturnValue(null);
        mockedBeads.createTask.mockReturnValue('bd-1234');

        await syncIssue({ ...baseEvent, action: 'reopened' });

        expect(mockedBeads.createTask).toHaveBeenCalled();
      });
    });

    describe('deleted action', () => {
      it('should delete existing task', async () => {
        mockedBeads.findTaskByIssueNumber.mockReturnValue('bd-1234');

        await syncIssue({ ...baseEvent, action: 'deleted' });

        expect(mockedBeads.deleteTask).toHaveBeenCalledWith('bd-1234');
      });

      it('should skip if task not found', async () => {
        mockedBeads.findTaskByIssueNumber.mockReturnValue(null);

        await syncIssue({ ...baseEvent, action: 'deleted' });

        expect(mockedBeads.deleteTask).not.toHaveBeenCalled();
      });
    });
  });
});
