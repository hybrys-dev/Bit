# ADR 0005: Remote over SSH-stdio

## Status

Accepted

## Context

Remote agents stay on the user's own SSH config and keys. This ADR records the decision in section 13 of [docs/ARCHITECTURE.md](../ARCHITECTURE.md).

## Decision

Remote over SSH-stdio; native gateway for OpenClaw.

## Rejected

- A Bit daemon installed on servers

## Revisit when

ACP HTTP/WebSocket transport is stable.
