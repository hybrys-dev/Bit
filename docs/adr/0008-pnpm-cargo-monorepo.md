# ADR 0008: pnpm and Cargo monorepo

## Status

Accepted

## Context

The TypeScript workspace and the Tauri crate live in one repository. This ADR records the decision in section 13 of [docs/ARCHITECTURE.md](../ARCHITECTURE.md).

## Decision

pnpm + Cargo monorepo.

## Rejected

- Separate repositories

## Revisit when

The repo outgrows the agents' useful context.
