# Spike: character window

## Question

Can the placeholder companion window stay transparent, always on top, and click-through on macOS, Windows, KDE Wayland, and GNOME?

The design limits are in section 8 of [docs/ARCHITECTURE.md](../ARCHITECTURE.md): macOS uses a non-activating panel, Windows an always-on-top tool window, Linux X11 an input region shaped to the character, and KDE/Hyprland/Sway/COSMIC a gtk-layer-shell overlay. GNOME has no layer-shell and falls back to XWayland.

## Method

Launch the Tauri shell from `apps/desktop` on each desktop and check:

- the window has no decorations and a transparent background;
- it stays above other windows;
- clicks pass through the placeholder;
- it does not take focus when it appears.

Phase 1 wires that behaviour in the shell: `CompanionWindow::placeholder()` and `apply_placeholder` set always-on-top, no decorations, click-through, and the 160×160 size. Transparency and `focus: false` come from `tauri.conf.json`.

## Result

Not measured on macOS, Windows, KDE Wayland, or GNOME (`needs-human`).

One debug build was opened on the XFCE X11 session in this environment (1920×1200). Observed on the window titled Bit:

- border width 0 and Motif decorations disabled;
- `_NET_WM_STATE_ABOVE`, `_NET_WM_STATE_SKIP_TASKBAR`, and `_NET_WM_STATE_SKIP_PAGER`;
- it was not the active window after launch;
- mapped geometry 200×200 (the config asks for 160×160);
- the `bitd` sidecar stayed running.

Transparency was not checked visually. Click-through was not checked with a pointer event. WebKit logged a DRI3/EGL warning and the window still mapped.
