# ADR 0009: Direct distribution

## Status

Accepted

## Context

Bit is distributed outside the Mac App Store because the companion window uses macOS private APIs. This ADR records the decision in section 13 of [docs/ARCHITECTURE.md](../ARCHITECTURE.md).

## Decision

Direct distribution: GitHub Releases + updater, Homebrew, winget, AppImage, deb, rpm.

## Rejected

- Mac App Store

## Revisit when

The store becomes a requirement.
