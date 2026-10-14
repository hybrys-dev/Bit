# Spike: ACP capability matrix

## Question

Which of initialize, session/new, prompt, updates, cancel, config options (including effort), permission requests, and session list does each target agent expose over ACP?

The open question from the architecture is which effort options the Claude adapter exposes.

## Method

Run each official launch command from section 4 of [docs/ARCHITECTURE.md](../ARCHITECTURE.md) against a real account, record the `initialize` capabilities and the `configOptions` returned by `session/new`, then exercise prompt, updates, cancel, permission requests, and `session/list`.

Launch commands to probe, copied from the design contract (not measured here):

| Agent | Launch command |
| --- | --- |
| Claude Code | `npx @agentclientprotocol/claude-agent-acp` |
| Codex | `npx @agentclientprotocol/codex-acp` |
| OpenCode | `opencode acp` |
| Cursor | `agent acp` |
| OpenClaw | `openclaw acp --url wss://HOST:18789 --token-file FILE` |
| Hermes | `hermes acp` |

## Result

Not measured. This needs the owner (`needs-human`): the six agents need real installs and accounts, and Bit's tests must not use the network or real agents.

| Agent | initialize | session/new | prompt | updates | cancel | config options / effort | permission requests | session list |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | not measured | not measured | not measured | not measured | not measured | not measured | not measured | not measured |
| Codex | not measured | not measured | not measured | not measured | not measured | not measured | not measured | not measured |
| OpenCode | not measured | not measured | not measured | not measured | not measured | not measured | not measured | not measured |
| Cursor | not measured | not measured | not measured | not measured | not measured | not measured | not measured | not measured |
| OpenClaw | not measured | not measured | not measured | not measured | not measured | not measured | not measured | not measured |
| Hermes | not measured | not measured | not measured | not measured | not measured | not measured | not measured | not measured |
