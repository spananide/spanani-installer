use std::{
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
};

use isideload::util::{
    keyring_storage::KeyringStorage,
    storage::{InMemoryStorage, SideloadingStorage},
};
use once_cell::sync::Lazy;
use rootcause::Report;
use tauri::{AppHandle, Manager};
use tracing::{info, warn};

use crate::error::AppError;

static FORCE_DISABLE_KEYRING: AtomicBool = AtomicBool::new(false);

static SESSION_STORAGE: Lazy<InMemoryStorage> = Lazy::new(InMemoryStorage::new);

struct SessionStorage;

impl SideloadingStorage for SessionStorage {
    fn store(&self, key: &str, value: &str) -> Result<(), Report> {
        SESSION_STORAGE.store(key, value)
    }

    fn retrieve(&self, key: &str) -> Result<Option<String>, Report> {
        SESSION_STORAGE.retrieve(key)
    }

    fn store_data(&self, key: &str, value: &[u8]) -> Result<(), Report> {
        SESSION_STORAGE.store_data(key, value)
    }

    fn retrieve_data(&self, key: &str) -> Result<Option<Vec<u8>>, Report> {
        SESSION_STORAGE.retrieve_data(key)
    }

    fn delete(&self, key: &str) -> Result<(), Report> {
        SESSION_STORAGE.delete(key)
    }
}

#[tauri::command]
pub fn force_disable_keyring(force: bool) {
    FORCE_DISABLE_KEYRING.store(force, Ordering::Relaxed);

    if force {
        warn!("Keyring has been forcefully disabled by the user.");
    } else {
        let available = check_keyring_available();
        if !available {
            warn!("Keyring is not available and cannot be enabled.");
        }
    }
}

#[tauri::command]
pub fn keyring_available() -> bool {
    !FORCE_DISABLE_KEYRING.load(Ordering::Relaxed) && check_keyring_available()
}

fn check_keyring_available() -> bool {
    let entry = keyring::Entry::new("iloader", "test");
    if let Ok(entry) = entry {
        return entry.set_password("test").is_ok() && entry.get_password().is_ok();
    }
    false
}

pub fn create_sideloading_storage(
    _app: &AppHandle,
) -> Result<Box<dyn SideloadingStorage>, AppError> {
    if keyring_available() {
        Ok(Box::new(KeyringStorage::new("iloader".to_string())))
    } else {
        warn!(
            "Keyring is not available, keeping sideloading data in memory only. Nothing is saved to disk."
        );
        Ok(Box::new(SessionStorage))
    }
}

pub fn delete_session_data(key: &str) -> bool {
    let existed = matches!(SESSION_STORAGE.retrieve(key), Ok(Some(_)));
    let _ = SESSION_STORAGE.delete(key);
    existed
}

fn is_insecure_storage_entry(path: &Path, name: &str, is_dir: bool) -> bool {
    if is_dir {
        name.len() == 64
            && name.chars().all(|c| c.is_ascii_hexdigit())
            && path.join("key").is_file()
    } else {
        name == "anisette_state" || name.starts_with("rppairing") || name.starts_with("host_label_")
    }
}

pub fn remove_insecure_storage(app: &AppHandle) {
    let data_dir = match app.path().app_data_dir() {
        Ok(dir) => dir,
        Err(e) => {
            warn!("Failed to get app data directory for cleanup: {:?}", e);
            return;
        }
    };

    let entries = match std::fs::read_dir(&data_dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        let path = entry.path();
        if !is_insecure_storage_entry(&path, &name, file_type.is_dir()) {
            continue;
        }

        let result = if file_type.is_dir() {
            std::fs::remove_dir_all(&path)
        } else {
            std::fs::remove_file(&path)
        };

        match result {
            Ok(_) => info!("Removed unencrypted credential data: {}", name),
            Err(e) => warn!(
                "Failed to remove unencrypted credential data {}: {}",
                name, e
            ),
        }
    }
}
