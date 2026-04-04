# Bypass Mode (Step 3D)

Manages heuristic bypass patterns in `~/.claude/hooks/heuristic-patterns.txt`.

## Known heuristic registry

```json
{
  "command_substitution": {
    "regex": "\\$\\(",
    "comment": "\"Contains command_substitution\" — $() syntax"
  },
  "brace_obfuscation": {
    "regex": "\\{[^}]*['\"]",
    "comment": "\"Contains brace with quote character (expansion obfuscation)\""
  },
  "dot_source": {
    "regex": "(?:^|&&\\s*|;\\s*|\\|\\|\\s*)\\.\\s",
    "comment": "\"'.' evaluates arguments as shell code\""
  },
  "heredoc": {
    "regex": "<<-?\\s*\\\\?['\"]?\\w+",
    "comment": "\"Contains heredoc\" — <<EOF syntax"
  },
  "quoted_flags": {
    "regex": "\\s--?\\w+=(['\"])",
    "comment": "\"Command contains quoted characters in flag names\""
  },
  "cd_git_compound": {
    "regex": "cd\\s.*(?:&&|;|\\|\\|)\\s*git",
    "comment": "\"Compound commands with cd and git require approval\""
  },
  "consecutive_quotes": {
    "regex": "(?:^|\\s)['\"](?=['\"])",
    "comment": "\"Command contains consecutive quote characters at word start\""
  }
}
```

## Sub-modes

### List (`/allow bypass` with no arguments)

1. Read `~/.claude/hooks/heuristic-patterns.txt`
2. Print each non-comment, non-empty line with its line number
3. STOP.

### Add by name (`/allow bypass <name>`)

1. Look up `<name>` in the known heuristic table above
2. If not found, print error with available names and STOP
3. Read `~/.claude/hooks/heuristic-patterns.txt`
4. Check if the regex already exists in the file (grep for it). If yes: print `Already exists. No changes needed.` and STOP
5. Append to the file:
   ```
   # "<description>"
   <regex>
   ```
6. Print `Added bypass "<name>" to heuristic-patterns.txt`
7. STOP — do NOT continue to Step 4.

### Add custom (`/allow bypass custom "<regex>"`)

1. Extract the regex from quotes
2. Read `~/.claude/hooks/heuristic-patterns.txt`
3. Check if already exists. If yes, print duplicate message and STOP
4. Append: `# Custom pattern\n<regex>`
5. Print `Added custom bypass pattern to heuristic-patterns.txt`
6. STOP.

### Remove (`/allow deny bypass <name>` or `/allow remove bypass <name>`)

1. Look up `<name>` in the known heuristic table
2. Read `~/.claude/hooks/heuristic-patterns.txt`
3. Find and remove the regex line AND its preceding comment line
4. Write back the file
5. Print `Removed bypass "<name>" from heuristic-patterns.txt`
6. STOP.

## Step 3D-add (used by paste mode heuristic auto-detection)

This is the "add by name" sub-mode above, but called silently from paste mode. After the permission pattern is added in Step 4, print an additional line:
```
Also added bypass "<name>" to heuristic-patterns.txt
```
