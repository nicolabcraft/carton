//! Carton: a small window beside Boite that shows each subscription's limit
//! windows, whether they are used at the pace that pays for them, and what
//! the month's turns would have cost at API prices. Boite starts it with the
//! core's address and the owner's token in the environment; everything it
//! reads comes from the core, in the page.

mod endpoint;

use tauri::Manager;

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![endpoint::core_endpoint])
        .build(tauri::generate_context!())
        .expect("Carton could not start");
    // Closing the window quits with code 0: Boite then leaves Carton stopped
    // instead of starting it again as after a crash.
    app.run(|_handle, _event| {});
}
