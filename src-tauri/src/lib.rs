use std::path::PathBuf;
use std::process::Command;

use tauri::webview::{NewWindowResponse, WebviewWindowBuilder};
use tauri::Url;

const DEFAULT_APP_URL: &str = "http://127.0.0.1:18900";

fn app_origin_url(config: &tauri::Config) -> Url {
  #[cfg(dev)]
  if let Some(url) = &config.build.dev_url {
    return url.clone();
  }

  match &config.build.frontend_dist {
    Some(tauri::utils::config::FrontendDist::Url(url)) => url.clone(),
    _ => Url::parse(DEFAULT_APP_URL).expect("default app url"),
  }
}

fn is_app_url(url: &Url, app: &Url) -> bool {
  url.scheme() == app.scheme()
    && url.host() == app.host()
    && url.port_or_known_default() == app.port_or_known_default()
}

fn chrome_exe() -> Option<PathBuf> {
  let mut candidates = Vec::new();

  if let Ok(program_files) = std::env::var("ProgramFiles") {
    candidates.push(PathBuf::from(program_files).join(r"Google\Chrome\Application\chrome.exe"));
  }
  if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
    candidates.push(PathBuf::from(program_files_x86).join(r"Google\Chrome\Application\chrome.exe"));
  }
  if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
    candidates.push(PathBuf::from(local_app_data).join(r"Google\Chrome\Application\chrome.exe"));
  }

  candidates.push(PathBuf::from(
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
  ));
  candidates.push(PathBuf::from(
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  ));

  candidates.into_iter().find(|path| path.is_file())
}

fn open_in_chrome(url: &str) {
  if let Some(chrome) = chrome_exe() {
    let _ = Command::new(chrome).arg(url).spawn();
    return;
  }

  let _ = Command::new("cmd")
    .args(["/c", "start", "", url])
    .spawn();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      let window_config = app
        .config()
        .app
        .windows
        .first()
        .cloned()
        .expect("main window config");
      let app_url = app_origin_url(app.config());

      WebviewWindowBuilder::from_config(app.handle(), &window_config)?
        .initialization_script(
          r#"
          document.addEventListener('click', function (e) {
            var target = e.target;
            var a = target && target.closest ? target.closest('a[href]') : null;
            if (!a) return;
            if (a.closest('.aie-content, .editor-host, .note-editor, .ProseMirror, [contenteditable="true"]')) {
              return;
            }
            var href = a.href;
            if (!href || href.indexOf('javascript:') === 0) return;
            var external = false;
            try {
              external = new URL(href, location.href).origin !== location.origin;
            } catch (err) {
              external = true;
            }
            if (a.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey || external) {
              e.preventDefault();
              e.stopPropagation();
              window.open(href, '_blank');
            }
          }, true);
          "#,
        )
        .on_navigation(move |url| {
          if url.scheme() == "about" || is_app_url(url, &app_url) {
            return true;
          }
          open_in_chrome(url.as_str());
          false
        })
        .on_new_window(|url, _features| {
          if url.scheme() != "about" {
            open_in_chrome(url.as_str());
          }
          NewWindowResponse::Deny
        })
        .build()?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
