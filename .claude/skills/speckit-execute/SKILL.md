---
name: "speckit-execute"
description: "Execute tasks.md phase-by-phase with context isolation. Each phase runs in a fresh Claude session via `claude -p`, with subagent dispatch per task."
argument-hint: "Optional: phase number, --dry-run, or task filter"
compatibility: "Requires spec-kit project structure with .specify/ directory and tasks.md"
metadata:
  author: "custom"
  version: "1.0.0"
user-invocable: true
disable-model-invocation: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Overview

This skill orchestrates implementation of tasks.md using **phase-level context isolation**.
Unlike `/speckit-implement` (single session), each phase runs as an independent `claude -p` session
with full context reset, preventing context window exhaustion on large projects (50+ tasks).

**Architecture**:
```
execute-phases.sh
  |
  +-- claude -p "Phase 1 prompt"   (fresh session, subagents per task)
  +-- claude -p "Phase 2 prompt"   (fresh session, subagents per task)
  +-- claude -p "Phase 3 prompt"   (fresh session, subagents per task)
  ...
```

## Outline

1. **Prerequisites**: Run `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`
   from repo root. Parse FEATURE_DIR. Confirm tasks.md exists.

2. **Show Progress**: Parse tasks.md and display phase completion status:

   ```text
   Phase Summary:
     Phase 1: Setup (Shared Infrastructure)              [6/6]
     Phase 2: Foundational (Blocking Prerequisites)       [8/13]
     Phase 3: User Story 1 - Item Registration (P1) MVP  [0/14]
     ...
   ```

3. **Verify Script**: Check if `execute-phases.sh` exists at one of:
   - `.specify/scripts/bash/execute-phases.sh`
   - Project root `./execute-phases.sh`

   If NOT found: Copy from `~/.claude/scripts/execute-phases.sh` or inform user to install:
   ```bash
   cp ~/Downloads/Code/claude-code-setup/scripts/execute-phases.sh .specify/scripts/bash/
   chmod +x .specify/scripts/bash/execute-phases.sh
   ```

4. **Determine Execution Scope**:
   - If user input is empty: execute from first incomplete phase to last
   - If user input is a number (e.g., "3"): execute only that phase
   - If user input contains "--dry-run": preview without executing
   - If user input contains "status": show progress only, do not execute

5. **Provide Run Command**: Since `claude -p` sessions must run OUTSIDE the current Claude session
   (to achieve true context isolation), output the exact command for the user to run:

   ```bash
   # Execute all remaining phases
   bash .specify/scripts/bash/execute-phases.sh --max-turns 200

   # Execute only Phase 3
   bash .specify/scripts/bash/execute-phases.sh --phase 3 --max-turns 200

   # Dry run (preview prompts)
   bash .specify/scripts/bash/execute-phases.sh --dry-run

   # With verbose output
   bash .specify/scripts/bash/execute-phases.sh --verbose --max-turns 200

   # Resume from Phase 5
   bash .specify/scripts/bash/execute-phases.sh --start 5 --max-turns 200
   ```

   Explain that the user should run this in a **separate terminal** (not inside Claude Code)
   to achieve true session isolation.

6. **Alternative: In-Session Execution** (for small phases only):
   If the user explicitly asks to run within the current session, or if the target phase
   has 5 or fewer pending tasks, offer to execute directly using the Agent tool:

   - For each task: dispatch a fresh Agent subagent with full task context
   - Mark completed tasks as [x] in tasks.md
   - This does NOT provide session-level isolation, only subagent-level isolation

7. **Post-Execution Check** (if user returns after running the script):
   Re-read tasks.md and display updated progress. Highlight any failed/skipped tasks
   from the execution logs at `FEATURE_DIR/.execution-logs/`.

## Script Reference

`execute-phases.sh` accepts these options:

| Option | Default | Description |
|--------|---------|-------------|
| `--start N` | first incomplete | Start from phase N |
| `--end N` | last phase | Stop after phase N |
| `--phase N` | all | Execute only phase N |
| `--max-turns N` | 200 | Max agentic turns per phase |
| `--dry-run` | off | Preview without executing |
| `--verbose` | off | Show full claude output |
| `--model M` | (default) | Override model (sonnet, opus, haiku) |
| `--feature-dir D` | auto-detect | Override feature directory |

## Design Rationale

- **Phase isolation via `claude -p`**: Each phase starts with zero conversation history.
  CLAUDE.md, memory, and MCP servers reload fresh. No context bleed between phases.
- **Task isolation via Agent subagents**: Within a phase, each task runs in a subagent
  with its own context. The phase controller only accumulates verification results.
- **Progress via filesystem**: tasks.md `[x]` marks persist across sessions.
  The script auto-skips completed tasks on resume.
- **Logs**: Each phase writes to `FEATURE_DIR/.execution-logs/phase-N-TIMESTAMP.log`.
