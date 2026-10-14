# Bit architecture

This is the design contract that agents implement. It condenses the project design document
("Bit — Design di sistema", in Italian). Changing it requires the owner's approval through an ADR in `docs/adr/`.

## 1. Goals

- A desktop character that is the single cockpit for coding agents and for a general LLM chat.
- Agents: Claude Code, Codex, OpenCode, Cursor, OpenClaw and Hermes, local or remote. Adding an agent must not require rewriting Bit.
- For each session the user picks agent, model, effort, mode, project and session: new, or resumed even if it started outside Bit.
- One approvals inbox for every agent, answerable from the character's speech bubble.
- A general chat on any LLM API, local models included, that can be promoted to an agent session.

Out of scope for 0.1: phone remote control, sync between devices, multiple users, a Bit server, telemetry.

## 2. Targets

| Area | Target |
| --- | --- |
| Platforms | macOS 13+ (Apple Silicon, Intel), Windows 10/11 (x64, ARM), Linux X11; Wayland best effort |
| Idle footprint | Shell + core under 200 MB RAM, CPU near 0%, agents excluded |
| Startup | Under 2 s to an interactive character |
| Latency | Agent event to UI under 100 ms with 10 parallel sessions |
| Isolation | An agent crash never affects other sessions or the core |
| Privacy | Local-first, no telemetry, API keys only in the OS keychain |
| Security | No listening network port by default; never approve on the user's behalf without an explicit rule |
| Testability | At least 90% of the logic tested headless in CI, without API keys |
| Languages | English and Italian from the first release |

The phase 1 spikes validate these numbers; CI enforces them where possible.

## 3. System overview

```text
+------------------- Desktop shell (Tauri 2, Rust) -------------------+
|  Companion (character, bubble)  |  Panel (sessions, chat)  |  Tray  |
+---------------------------------+----------------------------------+
                                  | stdio, JSON-RPC 2.0 + events
+---------------------------------v----------------------------------+
|                  Core: bitd (TypeScript, headless)                 |
| Bit Protocol | Sessions & approvals | Storage (SQLite) | Supervisor |
| Agent Hub (ACP driver, extensions, native drivers) | LLM providers |
+-----------+-----------------------+--------------------+-----------+
            | child processes       | ssh / wss          | HTTPS
      Local agents (ACP)       Remote agents          LLM APIs
```

- The shell has no business logic: it relays messages between webview and core and owns OS integration.
- The UI talks only to the core and only through the Bit Protocol.
- The core owns everything else and runs without a GUI.

Prompt flow:

1. The UI calls `sessions.prompt`.
2. The core sends `session/prompt` to the agent over ACP.
3. The agent streams `session/update`; the core stores each update with a per-session `seq` and pushes `session.update` to the UI.
4. `session/request_permission` becomes an Approval; the character turns amber; the decision goes back with the exact request id.
5. At the end of the turn the core updates status and usage; the character shows "done".

## 4. Agent Hub

All six target agents speak ACP, so one generic driver covers them.

| Agent | Launch command | Notes |
| --- | --- | --- |
| Claude Code | `npx @agentclientprotocol/claude-agent-acp` | Adapter over the Claude Agent SDK. Check which effort options it exposes. |
| Codex | `npx @agentclientprotocol/codex-acp` | Starts the Codex app-server. Model and reasoning effort are separate config options. |
| OpenCode | `opencode acp` | Native ACP. |
| Cursor | `agent acp` | Auth method `cursor_login`; modes agent, plan, ask. Must answer the blocking extensions `cursor/ask_question` and `cursor/create_plan`, or the agent stalls. |
| OpenClaw | `openclaw acp --url wss://HOST:18789 --token-file FILE` | Bridge to a local or remote Gateway. Model selection is not exposed over ACP: use the Gateway protocol for it. |
| Hermes | `hermes acp` | Model menu over ACP (`provider:model`), persistent sessions with fork, approvals include `allow_session`. |

Driver layers:

1. **Generic ACP driver (default):** `initialize`, `authenticate`, `session/new`, `load`, `resume`, `list`, `close`, `prompt`, `cancel`, `set_config_option`, `session/update`, `session/request_permission`, elicitation. Any agent in the ACP registry works without new code.
2. **Per-agent extensions:** small modules for vendor methods, binary detection, version checks and login state.
3. **Native drivers:** only with an ADR that documents a missing capability. The first one planned is the OpenClaw Gateway, for model selection.

Client capabilities in 0.1: Bit offers no delegated file system or terminal access; agents use their own tools.
Credentials stay with each agent: Bit only detects the login state and explains how to log in.

**Observer mode.** For sessions started in a terminal or IDE, `tools/bit-hook` forwards agent hook events to the core
over a Unix socket or named pipe. If Bit is not running, the hook exits immediately and never blocks the agent.

**Remote agents.**

- SSH-stdio, for any ACP agent: `ssh -T HOST -- hermes acp`. The agent runs remotely with its own credentials. No open ports; the user's SSH config and keys are used; host keys are never accepted automatically.
- OpenClaw: the local `openclaw acp` bridge connects to the Gateway over WSS with a token file, reachable through Tailscale or a tunnel, never exposed to the internet.
- If the channel drops, the core resumes with `session/resume` and tells the UI.
- When ACP's HTTP/WebSocket transport becomes stable it becomes a third option.

## 5. Models, effort and modes

- Bit keeps no model catalog for agents. It renders the `configOptions` returned by the agent, in the agent's order.
- The category decides placement: `model` next to the agent name, `thought_level` as the effort selector, `mode` as a switch, `model_config` in the model panel.
- Every change goes through `session/set_config_option`; the response carries the full state, so dependent options (effort per model) update by themselves.
- Agents that only expose legacy `modes` fall back to them. If an agent exposes nothing, no selector is shown: never invent options.
- Effort shortcuts use a common UI scale (minimal, low, medium, high, max) mapped per agent extension; the agent always receives its native value, for example Codex `xhigh`.
- Defaults cascade: session choice, then project default, then Bit's default for that agent, then the agent's own default.

## 6. Projects and sessions

- A project is a working root, local (`/path`) or remote (`ssh://host/path`), with name, colour, selector defaults and approval rules.
- Bit proposes projects from `session/list` (filtered by cwd) and recent Git repositories; the user confirms.
- One list per project shows the sessions of every agent: title, agent, model, last activity, status (working, waiting for you, idle, error).
- The primary source is the agent's `session/list`, plus sessions started by Bit and a local cache for agents that cannot list.
- Resume with `session/resume`, or `session/load` when the history must be replayed.
- 0.1 never reads the agents' private files on disk. If that becomes necessary, it lives in an isolated module with contract tests.

## 7. Chat and LLM providers

- The chat talks to models directly through a provider layer built on the Vercel AI SDK.
- "Every API" means four dialects plus custom endpoints: OpenAI Chat Completions compatible, OpenAI Responses, Anthropic Messages, Google Gemini. AWS Bedrock, Google Vertex AI and Azure OpenAI use dedicated providers.
- A custom endpoint is dialect + base URL + headers + key.
- Model metadata (context, prices, reasoning and image support) comes from the models.dev catalog; custom endpoints use `/v1/models` when available, otherwise the user types the id.
- Effort in the chat maps to the provider parameter (reasoning effort, thinking budget) only for models that support it.
- Keys live in the OS keychain (Keychain, Credential Manager, Secret Service).
- A `ProviderAdapter` interface adds an unusual dialect without touching the rest.
- "Promote to session" turns a chat into the first prompt of an agent session on a chosen project.

## 8. Companion UX

The character is a small toggle switch with a face: a capsule whose knob slides from 0 (idle) to 1 (working); the
eyes are two blinking terminal cursors. It is original and must not resemble other projects' mascots.

States by priority (the most urgent wins; a badge counts the others):

1. Needs your OK: amber light and a bubble with the request; buttons Allow, Always, Deny.
2. Question from an agent: bubble with the choices.
3. Error: X eyes, message, Retry.
4. Working: knob on 1, moving light.
5. Done: small jump and a summary.
6. Idle: knob on 0; may hide at the screen edge.

Surfaces: the companion window (transparent, frameless, always on top, never steals focus, click-through except on
the character, draggable, snaps to edges, remembers its position per monitor); the bubble; the panel (Sessions,
Chat, Approvals, Settings, with the selectors in the composer bar); the tray or menu bar. Global hotkeys, file drop
on the character, native notifications with actions, Do not disturb, reduced motion, and a demo mode reused by the
end-to-end tests. Long commands are approved from the panel only, never from the bubble.

| OS | Technique | Known limit |
| --- | --- | --- |
| macOS | Non-activating panel (NSPanel through a Tauri plugin), visible on all Spaces | Transparency uses macOS private APIs: no Mac App Store |
| Windows | Always-on-top tool window, transparent WebView2 | Unsigned builds trigger SmartScreen on first run |
| Linux X11 | Always-on-top window with the input region shaped to the character | None known |
| Linux Wayland | gtk-layer-shell overlay (KDE, Hyprland, Sway, COSMIC) | GNOME has no layer-shell: fall back to XWayland |

## 9. Bit Protocol

- JSON-RPC 2.0. Production transport: stdio between the core sidecar and the shell, relayed to the webview; no network port.
- Development and tests: the same protocol over WebSocket on loopback, with a random token and an Origin check.
- Zod schemas in `packages/protocol` generate TypeScript types and JSON Schema. A compatibility test blocks breaking changes; the protocol version is negotiated when the UI connects.

| Area | Methods |
| --- | --- |
| Agents | `agents.list`, `agents.detect`, `agents.add`, `agents.doctor` |
| Projects | `projects.list`, `projects.add`, `projects.update` |
| Sessions | `sessions.list`, `sessions.create`, `sessions.resume`, `sessions.prompt`, `sessions.cancel`, `sessions.setOption`, `sessions.close` |
| Approvals | `approvals.list`, `approvals.respond` (exact request id, idempotent) |
| Chat | `chats.list`, `chats.send`, `chats.promote` |
| Providers | `providers.list`, `providers.upsert`, `providers.test`, `models.list` (secrets are write-only) |
| System | `system.health`, `system.settings` |

Events pushed by the core: `session.update` (aligned with ACP `session/update`), `session.status`,
`approval.requested`, `approval.resolved`, `agent.status`, `chat.delta`. Each event carries a per-session `seq`; a
reconnecting UI asks for the events after the last `seq` it saw.

## 10. Data model

SQLite in WAL mode in the app data folder, versioned migrations, automatic backup before each migration.

| Entity | Key fields |
| --- | --- |
| Agent | kind, transport (local, ssh, gateway), command, version, login state |
| Project | name, root, selector defaults, approval rules |
| Session | agent, project, native session id, title, current options, status |
| SessionEvent | session, seq, type, JSON payload (append-only, configurable retention) |
| Approval | request, options, decision, timestamps |
| ApprovalRule | project, agent, pattern, decision (only rules the user creates) |
| Provider | dialect, base URL, headers, reference to the keychain secret |
| Chat, ChatMessage | model, messages, attachments (full-text search) |

## 11. Security model

| Threat | Mitigation |
| --- | --- |
| A website tries to drive Bit through localhost | No port in production; the dev transport requires a random token and checks the Origin |
| A client that answers permission requests by itself turns the agent into unattended execution | Bit never answers on its own; automatic rules exist only if the user creates them, per project, visible and revocable |
| Prompt injection in files or pages the agent reads | Consent always shows the full command or diff; long commands only from the panel |
| API key theft | OS keychain only; automatic redaction in logs |
| Remote host impersonation | SSH host keys verified, never auto-accepted; gateways only over WSS or a private network |
| Malicious update | Signed updater artifacts; builds only from CI with provenance attestation |
| Compromised webview | Strict CSP, minimal Tauri capabilities per window, no direct shell or file access from the UI |

## 12. Reliability and observability

- Each agent is a child process with its own supervisor. On a crash the session goes to "error", the core restarts the process with backoff (1, 2, 4 s, up to 30 s) and resumes with `session/resume`; after 3 failures it stops and tells the user.
- A silent agent triggers a warning, never an automatic kill.
- Approvals that an agent expires by itself (Hermes defaults to 300 s) are shown as expired, not as denied by the user.
- The core outlives the panel; quitting Bit asks what to do with running sessions. A shell watchdog restarts an unresponsive core; the UI resyncs through `seq`.
- The UI applies updates once per frame; long lists and transcripts are virtualised.
- Local structured logs with rotation and redaction; a Diagnostics page exports an anonymised bundle; no telemetry; crash reports only with explicit consent.

## 13. Decisions

Each row becomes an ADR in `docs/adr/` during phase 1.

| ADR | Decision | Rejected | Revisit when |
| --- | --- | --- | --- |
| 0001 | Tauri 2 shell | Electron; native per OS | Wayland or macOS block the character: swap the shell, keep UI and core |
| 0002 | TypeScript core on Node.js LTS, as a sidecar | Rust core inside Tauri | Footprint above target: port the hot path to Rust (ACP Rust SDK 1.0) |
| 0003 | ACP first, targeted native drivers | A native driver per agent; hooks only | An adapter lags on a key capability |
| 0004 | Selectors from agent config options | A catalog maintained by Bit | A major agent exposes no config options |
| 0005 | Remote over SSH-stdio; native gateway for OpenClaw | A Bit daemon installed on servers | ACP HTTP/WebSocket transport is stable |
| 0006 | Vercel AI SDK + models.dev for the chat | LiteLLM (Python); hand-written clients | The library breaks too often |
| 0007 | Local SQLite | JSON files; a database server | Sync between devices arrives |
| 0008 | pnpm + Cargo monorepo | Separate repositories | The repo outgrows the agents' useful context |
| 0009 | Direct distribution: GitHub Releases + updater, Homebrew, winget, AppImage, deb, rpm | Mac App Store | The store becomes a requirement |

## 14. Open questions

- Which effort options the Claude adapter exposes over ACP (phase 1 spike).
- The exact model selection API of the OpenClaw Gateway (phase 3).
- The footprint of the Node.js sidecar against the 200 MB target (phase 1 spike).
