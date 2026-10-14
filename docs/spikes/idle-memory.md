# Spike: idle memory of shell + core

## Question

Does the Tauri shell plus the `bitd` core stay under 200 MB of RAM while idle, agents excluded? The target is in section 2 of [docs/ARCHITECTURE.md](../ARCHITECTURE.md). The phase 1 spike measures the footprint; CI enforcement of the 200 MB budget is phase 4.

## Method

Start `bitd` with stdin held open and no requests, sample RSS once it is waiting, then start the shell with the core sidecar and sample the pair. Report the platform, the build, and that the sample is not a CI gate.

## Result

One idle sample on this Linux machine, debug build (`cargo build`, unoptimized), Node.js 24.21.0. Not a release build and not a CI gate. The 200 MB check in CI belongs to phase 4.

Core only, `node packages/core/dist/bin.js` waiting on stdin with no requests: RSS 66,460 KB.

Shell + core a few seconds after the debug shell mapped the placeholder window, agents excluded:

| Process | RSS |
| --- | --- |
| `bit` | 163,836 KB |
| WebKitNetworkProcess | 54,408 KB |
| WebKitWebProcess | 222,844 KB |
| `bitd` (Node sidecar) | 67,636 KB |
| Sum | 508,724 KB |

That sum is about 497 MB, above the 200 MB target. It is a single debug sample on XFCE X11, not a measurement of a release build, and not a measurement on macOS, Windows, or Wayland (`needs-human` for those machines).
