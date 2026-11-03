//! Where Boite's core is. Boite starts Carton with `BOITE_CORE_URL` and
//! `BOITE_TOKEN`; started by hand, Carton reads the `core.json` the core
//! writes in Boite's data directory, as Boite's CLI does.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Serialize, Debug, PartialEq, Clone)]
pub struct CoreEndpoint {
    pub url: String,
    pub token: String,
    /// `env` when Boite launched Carton, `file` when found in `core.json`.
    pub source: &'static str,
}

#[derive(Deserialize)]
struct CoreFile {
    port: u16,
    host: Option<String>,
    token: String,
}

fn from_env(url: Option<String>, token: Option<String>) -> Option<CoreEndpoint> {
    let url = url.map(|url| url.trim().trim_end_matches('/').to_string()).filter(|url| !url.is_empty())?;
    let token = token.filter(|token| !token.trim().is_empty())?;
    Some(CoreEndpoint { url, token, source: "env" })
}

/// A core bound to every address is reached on the loopback; an IPv6 host goes in brackets.
fn endpoint_of(file: CoreFile) -> CoreEndpoint {
    let host = match file.host.as_deref().map(str::trim) {
        Some("0.0.0.0") | Some("::") | Some("") | None => "127.0.0.1".to_string(),
        Some(host) if host.contains(':') && !host.starts_with('[') => format!("[{host}]"),
        Some(host) => host.to_string(),
    };
    CoreEndpoint { url: format!("http://{host}:{}", file.port), token: file.token, source: "file" }
}

fn parse_core_file(text: &str) -> Option<CoreEndpoint> {
    let file: CoreFile = serde_json::from_str(text).ok()?;
    if file.token.trim().is_empty() || file.port == 0 {
        return None;
    }
    Some(endpoint_of(file))
}

fn read_core_file(path: &Path) -> Option<CoreEndpoint> {
    parse_core_file(&std::fs::read_to_string(path).ok()?)
}

/// Boite's data directory: `BOITE_DATA_DIR`, else the stable install's.
fn data_dir() -> Option<PathBuf> {
    if let Some(dir) = std::env::var_os("BOITE_DATA_DIR").filter(|dir| !dir.is_empty()) {
        return Some(PathBuf::from(dir));
    }
    default_data_dir()
}

#[cfg(windows)]
fn default_data_dir() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|local| PathBuf::from(local).join("boite2"))
}

#[cfg(target_os = "macos")]
fn default_data_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join("Library").join("Application Support").join("boite2"))
}

#[cfg(all(not(windows), not(target_os = "macos")))]
fn default_data_dir() -> Option<PathBuf> {
    dirs::data_dir().map(|data| data.join("boite2"))
}

#[tauri::command]
pub fn core_endpoint() -> Option<CoreEndpoint> {
    from_env(std::env::var("BOITE_CORE_URL").ok(), std::env::var("BOITE_TOKEN").ok())
        .or_else(|| data_dir().and_then(|dir| read_core_file(&dir.join("core.json"))))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn env_needs_both_halves() {
        assert_eq!(from_env(Some("http://127.0.0.1:4000/".into()), None), None);
        assert_eq!(from_env(None, Some("t".into())), None);
        let found = from_env(Some(" http://127.0.0.1:4000/ ".into()), Some("t".into())).unwrap();
        assert_eq!(found.url, "http://127.0.0.1:4000");
        assert_eq!(found.source, "env");
    }

    #[test]
    fn core_file_reaches_a_wildcard_on_the_loopback() {
        let found = parse_core_file(r#"{"port":4000,"host":"0.0.0.0","token":"t"}"#).unwrap();
        assert_eq!(found.url, "http://127.0.0.1:4000");
        let v6 = parse_core_file(r#"{"port":4000,"host":"fd00::1","token":"t"}"#).unwrap();
        assert_eq!(v6.url, "http://[fd00::1]:4000");
    }

    #[test]
    fn core_file_without_token_or_port_is_no_core() {
        assert_eq!(parse_core_file(r#"{"port":0,"token":"t"}"#), None);
        assert_eq!(parse_core_file(r#"{"port":4000,"token":" "}"#), None);
        assert_eq!(parse_core_file("not json"), None);
    }
}
