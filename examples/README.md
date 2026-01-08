# Example Usage

This directory contains example configurations for using the Beads Actions sync tool.

## Simple Example

The simplest way to use this action:

```yaml
# .github/workflows/sync-issues.yml
name: Sync Issues to Beads

on:
  issues:
    types: [opened, edited, closed, reopened, deleted]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: srt32/beads-actions@v1
```

## Custom Configuration

For more control over the sync process:

```yaml
# .github/workflows/sync-issues.yml
name: Sync Issues to Beads

on:
  issues:
    types: [opened, edited, closed, reopened]
    # Note: Removed 'deleted' to keep tasks even after issue deletion

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Sync to Beads
        uses: srt32/beads-actions@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Multiple Repositories

You can sync issues from multiple repositories to a single Beads instance by:

1. Setting up the workflow in each repository
2. Using the same Beads repository (can be a separate dedicated repo)
3. Using different prefixes or tags to distinguish issues from different repos

Example for multi-repo setup:

```yaml
# In repo A: .github/workflows/sync-issues.yml
name: Sync to Beads

on:
  issues:
    types: [opened, edited, closed, reopened, deleted]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: your-org/beads-central
          token: ${{ secrets.BEADS_PAT }}
      
      - uses: srt32/beads-actions@v1
```

## Label-Based Priority Example

Add these labels to your repository for automatic priority mapping:
- `p0` or `critical` → Priority 0 (Highest)
- `p1` or `high` → Priority 1
- `p2` → Priority 2 (Default)
- `p3` or `low` → Priority 3

Example issue creation with priority:
```markdown
Title: Fix critical security vulnerability
Labels: p0, security, bug
```

This will create a Beads task with Priority 0.
