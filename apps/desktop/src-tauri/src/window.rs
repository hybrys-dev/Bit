/// Placeholder companion window. Click-through is applied at runtime; Tauri's
/// config file has no cursor-ignore flag.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CompanionWindow {
    pub transparent: bool,
    pub always_on_top: bool,
    pub decorations: bool,
    pub click_through: bool,
    pub focus: bool,
    pub width: u32,
    pub height: u32,
}

impl CompanionWindow {
    pub fn placeholder() -> Self {
        Self {
            transparent: true,
            always_on_top: true,
            decorations: false,
            click_through: true,
            focus: false,
            width: 160,
            height: 160,
        }
    }
}

pub const COMPANION_LABEL: &str = "companion";

#[cfg(test)]
mod tests {
    use super::{CompanionWindow, COMPANION_LABEL};

    #[test]
    fn placeholder_is_transparent_always_on_top_and_click_through() {
        let window = CompanionWindow::placeholder();
        assert!(window.transparent);
        assert!(window.always_on_top);
        assert!(window.click_through);
        assert!(!window.decorations);
        assert!(!window.focus);
        assert_eq!(window.width, 160);
        assert_eq!(window.height, 160);
    }

    #[test]
    fn tauri_config_matches_the_placeholder() {
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).expect("tauri config is json");
        let window = &config["app"]["windows"][0];
        let expected = CompanionWindow::placeholder();
        assert_eq!(window["label"], COMPANION_LABEL);
        assert_eq!(window["transparent"], expected.transparent);
        assert_eq!(window["alwaysOnTop"], expected.always_on_top);
        assert_eq!(window["decorations"], expected.decorations);
        assert_eq!(window["focus"], expected.focus);
        assert_eq!(window["width"], expected.width);
        assert_eq!(window["height"], expected.height);
        assert_eq!(config["bundle"]["externalBin"][0], "binaries/bitd");
    }
}
