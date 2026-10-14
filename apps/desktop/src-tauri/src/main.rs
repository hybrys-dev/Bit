#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(error) = bit_desktop::run() {
        eprintln!("bit desktop failed: {error}");
        std::process::exit(1);
    }
}
