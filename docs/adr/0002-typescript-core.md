# ADR 0002: TypeScript core on Node.js LTS

## Status

Accepted

## Context

The core has to run and be tested without a GUI. This ADR records the decision in section 13 of [docs/ARCHITECTURE.md](../ARCHITECTURE.md).

## Decision

TypeScript core on Node.js LTS, as a sidecar.

## Rejected

- Rust core inside Tauri

## Revisit when

Footprint above target: port the hot path to Rust (ACP Rust SDK 1.0).
