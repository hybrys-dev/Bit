# ADR 0006: Vercel AI SDK and models.dev

## Status

Accepted

## Context

The general chat talks to LLM APIs through a provider layer. This ADR records the decision in section 13 of [docs/ARCHITECTURE.md](../ARCHITECTURE.md).

## Decision

Vercel AI SDK + models.dev for the chat.

## Rejected

- LiteLLM (Python)
- hand-written clients

## Revisit when

The library breaks too often.
