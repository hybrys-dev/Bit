# ADR 0003: ACP first

## Status

Accepted

## Context

Agents are integrated through one protocol so adding an agent does not rewrite Bit. This ADR records the decision in section 13 of [docs/ARCHITECTURE.md](../ARCHITECTURE.md).

## Decision

ACP first, targeted native drivers.

## Rejected

- A native driver per agent
- hooks only

## Revisit when

An adapter lags on a key capability.
