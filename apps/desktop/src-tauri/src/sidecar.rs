pub const SIDECAR_NAME: &str = "bitd";

#[cfg(test)]
mod tests {
    use super::SIDECAR_NAME;

    #[test]
    fn sidecar_name_matches_the_external_binary() {
        assert_eq!(SIDECAR_NAME, "bitd");
    }
}
