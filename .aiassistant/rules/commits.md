---
apply: always
---

# Git Commit Rules - CRITICAL

1. **NEVER** use `git commit` under any circumstances. Committing is a privilege reserved strictly for the user.
2. When you reach a milestone, a stable state, or complete a significant part of a task, you should **suggest** that the user commits the changes.
3. You may provide a suggested commit message, but the user must be the one to execute the command.
4. Ask for explicit permission from the user when running any CLI command other than traditional read-only Unix commands (like `ls`, `grep`, `cat`).