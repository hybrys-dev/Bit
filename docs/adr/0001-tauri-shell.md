# ADR 0001: Tauri 2 shell

## Status

Accepted

## Context

Bit needs a desktop shell for the companion character. This ADR records the decision in section 13 of [docs/ARCHITECTURE.md](../ARCHITECTURE.md).

## Decision

Tauri 2 shell.

## Rejected

- Electron
- native per OS

## Revisit when

Wayland or macOS block the character: swap the shell, keep UI and core.
