#!/usr/bin/env bash
# =============================================================================
# execute-phases.sh - Phase-isolated task execution using claude -p
#
# Each phase runs in a fresh Claude session (full context reset).
# Within each session, tasks are dispatched as subagents for per-task isolation.
#
# Usage:
#   ./execute-phases.sh [OPTIONS]
#
# Options:
#   --start N         Start from phase N (default: first incomplete)
#   --end N           End at phase N (default: last phase)
#   --phase N         Execute only phase N
#   --max-turns N     Max agent turns per phase (default: 200)
#   --dry-run         Preview phases and prompts without executing
#   --feature-dir D   Override feature directory path
#   --verbose         Show full claude output (default: summary only)
#   --model M         Model to use (default: sonnet)
# =============================================================================

set -euo pipefail

# -- Guard: prevent nested Claude Code sessions --
if [ -n "${CLAUDECODE:-}" ]; then
  echo "Error: Cannot run inside a Claude Code session (CLAUDECODE env var detected)."
  echo "Run this script in a separate terminal, or: unset CLAUDECODE && $0 $*"
  exit 1
fi

# -- Cleanup on exit/interrupt --
CHILD_PIDS=()
cleanup() {
  for pid in "${CHILD_PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# -- Colors --
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# -- Defaults --
MAX_TURNS=200
START_PHASE=0
END_PHASE=99
SINGLE_PHASE=""
DRY_RUN=false
VERBOSE=false
FEATURE_DIR=""
MODEL=""

# -- Parse arguments --
while [[ $# -gt 0 ]]; do
  case $1 in
    --start)       START_PHASE="$2"; shift 2 ;;
    --end)         END_PHASE="$2"; shift 2 ;;
    --phase)       SINGLE_PHASE="$2"; shift 2 ;;
    --max-turns)   MAX_TURNS="$2"; shift 2 ;;
    --dry-run)     DRY_RUN=true; shift ;;
    --feature-dir) FEATURE_DIR="$2"; shift 2 ;;
    --verbose)     VERBOSE=true; shift ;;
    --model)       MODEL="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,/^# =====/p' "$0" | head -n -1 | sed 's/^# //'
      exit 0 ;;
    *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
  esac
done

# -- Detect repo root --
REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# -- Detect feature directory --
if [ -z "$FEATURE_DIR" ]; then
  if [ -f "$REPO_DIR/.specify/scripts/bash/check-prerequisites.sh" ]; then
    PREREQ_JSON=$(bash "$REPO_DIR/.specify/scripts/bash/check-prerequisites.sh" --json --require-tasks --include-tasks 2>/dev/null || echo "{}")
    FEATURE_DIR=$(echo "$PREREQ_JSON" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('FEATURE_DIR',''))" 2>/dev/null || echo "")
  fi

  if [ -z "$FEATURE_DIR" ]; then
    # Fallback: find specs/*/tasks.md
    TASKS_FOUND=$(find "$REPO_DIR/specs" -name "tasks.md" -maxdepth 2 2>/dev/null | head -1)
    if [ -n "$TASKS_FOUND" ]; then
      FEATURE_DIR=$(dirname "$TASKS_FOUND")
    else
      echo -e "${RED}Error: Could not detect feature directory. Use --feature-dir.${NC}"
      exit 1
    fi
  fi
fi

TASKS_FILE="$FEATURE_DIR/tasks.md"
LOG_DIR="$FEATURE_DIR/.execution-logs"

if [ ! -f "$TASKS_FILE" ]; then
  echo -e "${RED}Error: tasks.md not found at $TASKS_FILE${NC}"
  exit 1
fi

mkdir -p "$LOG_DIR"

# -- Verify claude CLI --
if ! command -v claude &>/dev/null; then
  echo -e "${RED}Error: 'claude' CLI not found in PATH${NC}"
  exit 1
fi

# =============================================================================
# Phase parser: extracts phase_num, phase_name, total_tasks, completed_tasks
# =============================================================================
parse_phases() {
  local tasks_file="$1"
  local current_phase="" current_name="" total=0 done=0

  while IFS= read -r line; do
    if [[ "$line" =~ ^##[[:space:]]Phase[[:space:]]([0-9]+):(.*) ]]; then
      if [ -n "$current_phase" ]; then
        echo "${current_phase}|${current_name}|${total}|${done}"
      fi
      current_phase="${BASH_REMATCH[1]}"
      current_name="$(echo "${BASH_REMATCH[2]}" | sed 's/^ *//' | sed 's/ *$//')"
      total=0; done=0
    elif [[ "$line" =~ ^-[[:space:]]\[" "\] ]]; then
      ((total++)) || true
    elif [[ "$line" =~ ^-[[:space:]]\[[xX]\] ]]; then
      ((total++)) || true
      ((done++)) || true
    fi
  done < "$tasks_file"

  [ -n "$current_phase" ] && echo "${current_phase}|${current_name}|${total}|${done}"
}

# =============================================================================
# Extract incomplete tasks for a specific phase
# =============================================================================
get_pending_tasks() {
  local tasks_file="$1" phase_num="$2"
  local in_phase=false

  while IFS= read -r line; do
    if [[ "$line" =~ ^##[[:space:]]Phase[[:space:]]${phase_num}: ]]; then
      in_phase=true; continue
    elif $in_phase && [[ "$line" =~ ^##[[:space:]]Phase[[:space:]][0-9]+: ]]; then
      break
    elif $in_phase && [[ "$line" =~ ^---$ ]]; then
      break
    fi
    $in_phase && [[ "$line" =~ ^-[[:space:]]\[" "\] ]] && echo "$line"
  done < "$tasks_file"
}

# =============================================================================
# Generate the claude -p prompt for a phase
# =============================================================================
generate_prompt() {
  local phase_num="$1" phase_name="$2" tasks="$3"

  # Build context file list
  local ctx="Read these files for full project context:"
  ctx+="\n- ${FEATURE_DIR}/plan.md"
  ctx+="\n- ${FEATURE_DIR}/tasks.md"
  [ -f "$FEATURE_DIR/data-model.md" ]  && ctx+="\n- ${FEATURE_DIR}/data-model.md"
  [ -d "$FEATURE_DIR/contracts" ]       && ctx+="\n- All .md files in ${FEATURE_DIR}/contracts/"
  [ -f "$FEATURE_DIR/research.md" ]     && ctx+="\n- ${FEATURE_DIR}/research.md"
  [ -f "$FEATURE_DIR/quickstart.md" ]   && ctx+="\n- ${FEATURE_DIR}/quickstart.md"

  cat <<PROMPT
You are executing Phase ${phase_num}: ${phase_name}.

## Step 1: Load Context
$(echo -e "$ctx")

## Step 2: Tasks to Execute (Phase ${phase_num} ONLY)

${tasks}

## Step 3: Execution Pattern

For EACH task above, follow this cycle:

1. **Understand**: Read the task description, identify the target file path
2. **Dispatch subagent**: Use the Agent tool (subagent_type: "general-purpose") with a prompt that includes:
   - The complete task description and file path
   - Relevant context from plan.md (project structure, tech stack, conventions)
   - For service/router tasks: relevant contract details from contracts/
   - For database tasks: relevant entity details from data-model.md
3. **Verify**: After the subagent completes, check the file exists at the specified path
4. **Mark done**: Edit tasks.md -- change \`- [ ]\` to \`- [x]\` for this task
5. **Commit**: Run \`git add -A && git commit -m "feat(phase-${phase_num}): TXXX - short description"\`

## Rules
- Execute tasks top-to-bottom in the order listed
- Tasks marked [P] CAN be dispatched as parallel Agent calls in a single message
- If a task fails after 2 attempts, skip it, log the reason, and continue
- Do NOT modify tasks from other phases
- After all tasks are processed, print exactly this line:
  PHASE_RESULT:{"phase":${phase_num},"completed":N,"failed":N,"skipped":N}
PROMPT
}

# =============================================================================
# Execute a single phase via claude -p
# =============================================================================
execute_phase() {
  local phase_num="$1" phase_name="$2"
  local log_file="$LOG_DIR/phase-${phase_num}-$(date +%Y%m%d-%H%M%S).log"

  local tasks
  tasks=$(get_pending_tasks "$TASKS_FILE" "$phase_num")

  if [ -z "$tasks" ]; then
    echo -e "  ${GREEN}All tasks complete -- skipping${NC}"
    return 0
  fi

  local task_count
  task_count=$(echo "$tasks" | wc -l | tr -d ' ')

  if $DRY_RUN; then
    echo -e "  ${YELLOW}[DRY RUN] ${task_count} tasks would execute:${NC}"
    echo "$tasks" | sed 's/^/    /'
    echo ""
    echo -e "  ${YELLOW}Prompt preview:${NC}"
    generate_prompt "$phase_num" "$phase_name" "$tasks" | head -20
    echo "    ..."
    return 0
  fi

  echo -e "  ${CYAN}Dispatching ${task_count} tasks (max-turns: ${MAX_TURNS})${NC}"
  echo -e "  Log: ${log_file}"

  local prompt
  prompt=$(generate_prompt "$phase_num" "$phase_name" "$tasks")

  # Build claude command
  # --dangerously-skip-permissions: required for headless batch execution
  # without it, claude -p hangs on permission prompts with no terminal to respond
  local cmd=(claude -p "$prompt" --max-turns "$MAX_TURNS" --dangerously-skip-permissions)
  [ -n "$MODEL" ] && cmd+=(--model "$MODEL")
  # Non-verbose: batch output to log; Verbose: stream to terminal + log
  if ! $VERBOSE; then
    cmd+=(--output-format text)
  fi

  # Execute
  local exit_code=0

  if $VERBOSE; then
    # Run claude -p in background (output goes to log file on completion)
    "${cmd[@]}" --output-format text > "$log_file" 2>&1 &
    local claude_pid=$!
    CHILD_PIDS+=("$claude_pid")

    # Detect the session JSONL file by polling for a new file opened by claude
    local session_dir new_session="" tail_pid=""
    session_dir="$(find "$HOME/.claude/projects" -maxdepth 1 -type d -name "*$(basename "$REPO_DIR")*" 2>/dev/null | head -1)"

    if [ -n "$session_dir" ]; then
      echo -e "  ${CYAN}Waiting for session to start...${NC}"
      local attempts=0
      while [ -z "$new_session" ] && [ $attempts -lt 30 ] && kill -0 $claude_pid 2>/dev/null; do
        sleep 1
        ((attempts++)) || true
        # Find the most recently CREATED jsonl (newest by birth time on macOS)
        new_session=$(find "$session_dir" -name "*.jsonl" -newer "$log_file" -type f 2>/dev/null \
          | xargs ls -t 2>/dev/null | head -1)
      done

      if [ -n "$new_session" ]; then
        echo -e "  ${CYAN}Monitoring: $(basename "$new_session")${NC}"
        tail -f "$new_session" 2>/dev/null | python3 -uc "
import sys, json
for line in sys.stdin:
    try:
        obj = json.loads(line.strip())
        t = obj.get('type','')
        if t == 'assistant':
            for c in obj.get('message',{}).get('content',[]):
                if c.get('type') == 'text' and c['text'].strip():
                    txt = c['text'].replace('\n',' ')[:200]
                    print(f'  [TEXT] {txt}', flush=True)
                elif c.get('type') == 'tool_use':
                    name = c.get('name','')
                    inp = str(c.get('input',{}))[:120]
                    print(f'  [TOOL] {name}: {inp}', flush=True)
    except: pass
" &
        tail_pid=$!
        CHILD_PIDS+=("$tail_pid")
      else
        echo -e "  ${YELLOW}Could not detect session file -- check logs after completion${NC}"
      fi
    fi

    # Wait for claude to finish
    wait $claude_pid 2>/dev/null || exit_code=$?

    # Cleanup tail monitor
    [ -n "$tail_pid" ] && kill $tail_pid 2>/dev/null || true
    wait $tail_pid 2>/dev/null || true
    echo ""
  else
    "${cmd[@]}" > "$log_file" 2>&1 || exit_code=$?
    # Show only the result line
    grep "PHASE_RESULT:" "$log_file" 2>/dev/null || true
  fi

  # Count completed after execution
  local done_after
  done_after=$(parse_phases "$TASKS_FILE" | grep "^${phase_num}|" | cut -d'|' -f4)
  echo -e "  ${GREEN}Completed: ${done_after} tasks${NC}"

  if [ $exit_code -ne 0 ]; then
    echo -e "  ${RED}claude exited with code ${exit_code} -- check log${NC}"
  fi

  return $exit_code
}

# =============================================================================
# Main
# =============================================================================
main() {
  echo -e "${BOLD}=================================================${NC}"
  echo -e "${BOLD} Phase-Isolated Task Executor${NC}"
  echo -e " Feature : $(basename "$FEATURE_DIR")"
  echo -e " Tasks   : $TASKS_FILE"
  echo -e " Turns   : $MAX_TURNS per phase"
  [ -n "$MODEL" ] && echo -e " Model   : $MODEL"
  $DRY_RUN && echo -e " Mode    : ${YELLOW}DRY RUN${NC}"
  echo -e "${BOLD}=================================================${NC}"
  echo ""

  # Show phase summary
  local phases
  phases=$(parse_phases "$TASKS_FILE")

  echo -e "${BOLD}Phase Summary:${NC}"
  while IFS='|' read -r num name total done; do
    local status="${GREEN}${done}/${total}${NC}"
    [ "$done" -lt "$total" ] && status="${YELLOW}${done}/${total}${NC}"
    echo -e "  Phase ${num}: ${name}  [${status}]"
  done <<< "$phases"
  echo ""

  # Execute phases
  local failed_phases=""
  local executed=0

  while IFS='|' read -r num name total done; do
    # Apply filters
    [ -n "$SINGLE_PHASE" ] && [ "$num" != "$SINGLE_PHASE" ] && continue
    [ "$num" -lt "$START_PHASE" ] && continue
    [ "$num" -gt "$END_PHASE" ] && continue

    # Skip fully completed phases (unless explicitly targeted)
    if [ "$done" -eq "$total" ] && [ -z "$SINGLE_PHASE" ]; then
      continue
    fi

    echo -e "${BOLD}--- Phase ${num}: ${name} ---${NC}"
    if execute_phase "$num" "$name"; then
      ((executed++)) || true
    else
      failed_phases+=" $num"
      echo -e "${RED}Phase ${num} had errors. Continue? (Ctrl+C to abort)${NC}"
      sleep 2
    fi
    echo ""
  done <<< "$phases"

  # Summary
  echo -e "${BOLD}=================================================${NC}"
  echo -e "${BOLD} Execution Summary${NC}"
  echo -e " Phases executed : ${executed}"
  if [ -n "$failed_phases" ]; then
    echo -e " ${RED}Failed phases   :${failed_phases}${NC}"
    echo -e " Resume with     : $0 --start <N>"
  else
    echo -e " ${GREEN}Status          : All successful${NC}"
  fi
  echo -e "${BOLD}=================================================${NC}"
}

main "$@"
