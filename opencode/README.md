# Opencode Configuration

Configuration for [opencode](https://opencode.ai) CLI.

## Structure

- `opencode.json` - Main configuration
- `package.json` - Plugin dependencies

## Stow

```bash
stow opencode
```

This creates a symlink from `~/.config/opencode` to `opencode/.config/opencode/`.

## Post-Stow Setup

After stowing, install dependencies:

```bash
cd ~/.config/opencode
bun install
```
