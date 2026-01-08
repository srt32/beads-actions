# Beads Actions

A reusable GitHub Action that automatically synchronizes GitHub issues with [Beads](https://github.com/steveyegge/beads), a distributed Git-backed task tracker designed for coding agents.

## Overview

This action provides bidirectional synchronization between GitHub issues and Beads tasks:
- **GitHub → Beads**: Creates, updates, closes, and deletes Beads tasks when issues change
- **Beads → GitHub**: Closes and reopens GitHub issues when tasks are completed or reopened in Beads

This allows AI coding agents to access and manage tasks through the Beads system while keeping them in sync with your GitHub issues.

## Features

- ✅ **Bidirectional Synchronization**: Two-way sync between GitHub issues and Beads tasks
- ✅ **Automatic Updates**: Updates tasks/issues when either side changes
- ✅ **State Management**: Closes and reopens tasks/issues based on status
- ✅ **Priority Mapping**: Automatically sets task priority based on issue labels (P0-P3)
- ✅ **Label Sync**: Syncs GitHub labels to Beads task labels
- ✅ **Metadata Tracking**: Links tasks back to their GitHub issues

## Usage

### Method 1: Use as a Reusable Action (Recommended)

The simplest way to use this action is as a reusable GitHub Action:

1. Add the workflow file to your repository at `.github/workflows/sync-issues.yml`:

```yaml
name: Sync GitHub Issues to Beads

on:
  issues:
    types: [opened, edited, closed, reopened, deleted]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Sync to Beads
        uses: srt32/beads-actions@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

2. That's it! Issues will now automatically sync to Beads.

### Reverse Sync: Beads → GitHub

To also sync Beads task completions back to GitHub issues, add this workflow at `.github/workflows/reverse-sync.yml`:

```yaml
name: Sync Beads to GitHub Issues

on:
  push:
    branches: [ main ]
    paths:
      - '.beads/**'

jobs:
  reverse-sync:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install beads
        run: |
          curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
          echo "$HOME/.beads/bin" >> $GITHUB_PATH
      
      - name: Install dependencies
        run: npm ci
        working-directory: ./scripts
      
      - name: Build and run reverse sync
        run: |
          npm run build
          npm run reverse-sync
        working-directory: ./scripts
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: ${{ github.repository }}
```

This workflow:
- Triggers when `.beads/` files are pushed to main
- Reads all Beads tasks with linked GitHub issues
- Closes GitHub issues when tasks are completed in Beads
- Reopens GitHub issues when tasks are reopened in Beads

### Method 2: Self-Hosted Setup

If you prefer to host the sync scripts in your own repository:

1. Add the workflow file to your repository at `.github/workflows/sync-issues.yml`:

```yaml
name: Sync GitHub Issues to Beads

on:
  issues:
    types: [opened, edited, closed, reopened, deleted]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install beads
        run: |
          curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash
          echo "$HOME/.beads/bin" >> $GITHUB_PATH

      - name: Initialize beads if needed
        run: |
          if [ ! -d ".beads" ]; then
            bd init
          fi

      - name: Install dependencies
        run: npm ci
        working-directory: ./scripts

      - name: Sync issue to beads
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ISSUE_NUMBER: ${{ github.event.issue.number }}
          ISSUE_TITLE: ${{ github.event.issue.title }}
          ISSUE_BODY: ${{ github.event.issue.body }}
          ISSUE_STATE: ${{ github.event.issue.state }}
          ISSUE_LABELS: ${{ toJson(github.event.issue.labels) }}
          ACTION: ${{ github.event.action }}
          ISSUE_URL: ${{ github.event.issue.html_url }}
        run: npm start
        working-directory: ./scripts

      - name: Commit and push beads changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          if [ -n "$(git status --porcelain)" ]; then
            git add .beads/
            git commit -m "Sync issue #${{ github.event.issue.number }}: ${{ github.event.action }}"
            git push
          fi
```

2. Copy the `scripts/` directory from this repository to your repository

3. Install the sync script dependencies:

```bash
cd scripts
npm install
npm run build
```

4. Commit the `scripts/` directory to your repository

5. Create or modify issues in your repository - they will automatically sync to Beads!

### Configuration

#### Priority Mapping

The action automatically maps GitHub issue labels to Beads task priorities:

- **P0/Critical**: Labels containing "p0" or "critical" → Priority 0
- **P1/High**: Labels containing "p1" or "high" → Priority 1
- **P2**: Default priority → Priority 2
- **P3/Low**: Labels containing "p3" or "low" → Priority 3

#### Issue Events

The action responds to these GitHub issue events:

- **opened**: Creates a new Beads task
- **edited**: Updates the existing Beads task
- **closed**: Closes the corresponding Beads task
- **reopened**: Reopens the Beads task
- **deleted**: Marks the task as deleted and closes it

#### Known Limitations

- **Label Synchronization**: Labels are synced additively. When labels are removed from a GitHub issue, they are NOT automatically removed from the corresponding Beads task. This prevents accidentally removing manually added labels in Beads.
- **Security**: All user input is properly escaped before being passed to shell commands to prevent command injection.

## Development

### Prerequisites

- Node.js 20+
- npm or yarn
- Git

### Setup

```bash
cd scripts
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```

## Architecture

### Components

1. **Workflow File** (`.github/workflows/sync-issues.yml`): Defines the GitHub Action that triggers on issue events
2. **Sync Script** (`scripts/src/index.ts`): Main entry point that parses issue events
3. **Beads Interface** (`scripts/src/beads.ts`): Handles all interactions with the Beads CLI

### Data Flow

```
GitHub Issue Event
       ↓
GitHub Actions Workflow
       ↓
Parse Environment Variables
       ↓
Sync Logic (index.ts)
       ↓
Beads CLI Commands (beads.ts)
       ↓
.beads/ Directory Updates
       ↓
Git Commit & Push
```

### Task Metadata

Each Beads task created by this action includes the following metadata:

- `github_issue`: The issue number
- `github_url`: Link back to the GitHub issue

## Troubleshooting

### Workflow Fails with "bd: command not found"

Make sure the Beads installation step completed successfully. Check the workflow logs.

### Tasks Not Syncing

1. Verify that `.beads/` directory exists in your repository
2. Check that the workflow has write permissions to push commits
3. Review the workflow logs for error messages

### Duplicate Tasks

The action uses the `github_issue` metadata to prevent duplicates. If you have manual tasks, they won't be affected.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

## License

MIT

## Related Projects

- [Beads](https://github.com/steveyegge/beads) - The underlying task tracker
- [GitHub Actions](https://docs.github.com/en/actions) - Automation platform

## Support

For issues or questions:
- Open a GitHub issue
- Check the [Beads documentation](https://github.com/steveyegge/beads)
- Review the workflow logs in GitHub Actions