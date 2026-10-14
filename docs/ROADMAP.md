# Roadmap to Bit 0.1

The planner (`.github/workflows/agent-plan.yml`) reads this file and turns the current phase into issues.
The current phase is the first one whose exit criteria are not all met; progress is inferred from closed issues
and merged pull requests. Each task fits one pull request of about 400 changed lines.
Durations are estimates. Phase labels: `phase-1` to `phase-5`.

## Phase 1 — Foundations (weeks 1–2)

Exit criteria:

- pnpm monorepo with `packages/core`, `packages/protocol`, `apps/ui`, `apps/desktop`, `tools/fake-agent`; root `lint`, `typecheck`, `test` and `build` green in CI.
- Bit Protocol v0 schemas with generated types and JSON Schema, plus a compatibility test.
- Core skeleton: JSON-RPC over stdio and over the dev WebSocket (random token, Origin check); `system.health`; shared logger with secret redaction.
- `tools/fake-agent`: an ACP agent over stdio driven by scenario files (messages, tool calls, permission requests, config options, session list).
- ACP driver v0 passing end-to-end tests against the fake agent: initialize, session/new, prompt, updates, cancel.
- Tauri 2 shell that starts the core as a sidecar and shows a transparent, always-on-top, click-through placeholder window.
- ADRs 0001–0009 written from section 13 of docs/ARCHITECTURE.md.
- Spike reports in `docs/spikes/`: ACP capability matrix of the six agents; character window on macOS, Windows, KDE Wayland and GNOME; idle memory of shell + core. These may need the owner (`needs-human`) for real accounts and machines.

Suggested order:

1. Scaffold the monorepo: pnpm 12, TypeScript strict, ESLint, Vitest, root scripts, workspace packages with placeholder tests.
2. `packages/protocol`: v0 schemas, generated types, JSON Schema export, compatibility test.
3. `tools/fake-agent`: ACP stdio agent and scenario format.
4. `packages/core`: JSON-RPC server (stdio + dev WebSocket), `system.health`, logger.
5. `packages/core`: ACP driver v0 against the fake agent.
6. `apps/desktop`: Tauri 2 shell, sidecar wiring, placeholder companion window.
7. `docs/adr`: ADRs 0001–0009.
8. Spikes.

## Phase 2 — First agent (weeks 3–5)

Exit criteria:

- ACP driver complete: session list, resume, load, close; `set_config_option`; permission requests; elicitation; cancellation; usage updates.
- Projects and sessions in the core, stored in SQLite with migrations.
- Approvals inbox in core and UI, with exact request ids and idempotent answers.
- Panel UI: projects, session list, transcript, composer with selectors rendered from config options.
- Playwright end-to-end suite against core + fake agent running in CI.
- OpenCode and Claude Code usable end to end (manual check recorded in `docs/spikes/`, `needs-human`).

## Phase 3 — All agents (weeks 6–8)

Exit criteria:

- Extensions for Cursor (blocking methods, todos), Codex, Hermes and OpenClaw (ACP bridge + Gateway driver for model selection).
- Agent detection and doctor: binary, version, login state, install and login guidance.
- Remote agents over SSH (host key verification, reconnection with `session/resume`) and the OpenClaw Gateway over WSS.
- Observer mode with `tools/bit-hook` for Claude Code and Codex hooks.
- Contract tests with recorded transcripts for all six agents; optional nightly live smoke test.

## Phase 4 — Companion and chat (weeks 9–11)

Exit criteria:

- Character with the six states and priority rules, bubble approvals, reduced motion.
- Native notifications, global hotkeys, file drop.
- Provider layer: Vercel AI SDK, four dialects, custom endpoints, models.dev catalog, keychain storage.
- Chat UI with history, attachments and "promote to session".
- Onboarding: agent detection, login guidance, demo mode.
- i18n `en` and `it` complete; idle memory of shell + core under 200 MB, measured in CI.

## Phase 5 — Release 0.1 (weeks 12–13)

Exit criteria:

- Release workflow validated end to end by the owner (`needs-human`: workflows are owner-only).
- Updater signing keys and, optionally, code signing configured (`needs-human`).
- Install docs for Homebrew, winget, AppImage, deb and rpm, and a simple site.
- 0.1.0 published and installable on macOS, Windows and Linux.
