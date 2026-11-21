use std::{
    path::PathBuf,
    sync::{
        Mutex,
        atomic::{AtomicUsize, Ordering::SeqCst},
    },
    time::Duration,
};

use crate::{
    device::{DeviceInfoMutex, get_provider, get_provider_from_connection, get_usbmuxd},
    error::AppError,
    operation::Operation,
    pairing::{get_app_info_by_name, get_sidestore_info, place_file},
};
use isideload::{
    sideload::{application::SpecialApp, sideloader::Sideloader},
    util::callbacks::{ExtensionsBehaviorCallbackBox, MaxCertsCallbackBox},
};
use tauri::{AppHandle, Manager, State, Window};

static BUSY: std::sync::atomic::AtomicUsize = AtomicUsize::new(0);

pub type SideloaderMutex =
    Mutex<Option<Sideloader<MaxCertsCallbackBox, ExtensionsBehaviorCallbackBox>>>;

pub struct SideloaderGuard<'a> {
    state: &'a SideloaderMutex,
    sideloader: Option<Sideloader<MaxCertsCallbackBox, ExtensionsBehaviorCallbackBox>>,
}

impl<'a> SideloaderGuard<'a> {
    pub async fn take(state: &'a SideloaderMutex) -> Result<Self, AppError> {
        for _ in 0..600 {
            let is_busy = {
                let mut guard = state.lock().unwrap();
                if let Some(sideloader) = guard.take() {
                    BUSY.fetch_add(1, SeqCst);
                    return Ok(Self {
                        state,
                        sideloader: Some(sideloader),
                    });
                }
                BUSY.load(SeqCst) > 0
            };

            if !is_busy {
                return Err(AppError::NotLoggedIn);
            }

            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        Err(AppError::NotLoggedIn)
    }

    pub fn get_mut(
        &mut self,
    ) -> &mut Sideloader<MaxCertsCallbackBox, ExtensionsBehaviorCallbackBox> {
        self.sideloader
            .as_mut()
            .expect("Sideloader should be present")
    }
}

impl Drop for SideloaderGuard<'_> {
    fn drop(&mut self) {
        let mut guard = self.state.lock().unwrap();
        *guard = self.sideloader.take();
        BUSY.fetch_sub(1, SeqCst);
    }
}

pub async fn sideload(
    device_state: State<'_, DeviceInfoMutex>,
    sideloader_state: State<'_, SideloaderMutex>,
    app_path: String,
) -> Result<Option<SpecialApp>, AppError> {
    let device = {
        let device_lock = device_state.lock().unwrap();
        match &*device_lock {
            Some(d) => d.clone(),
            None => return Err(AppError::NoDeviceSelected),
        }
    };

    let provider = get_provider(&device.info).await?;

    let mut sideloader = SideloaderGuard::take(&sideloader_state).await?;

    let special = sideloader
        .get_mut()
        .install_app(
            &provider,
            app_path.into(),
            true,
            None::<fn(f32) -> std::future::Ready<()>>,
            Some(&device.pairing),
        )
        .await?;

    Ok(special)
}

#[tauri::command]
pub async fn sideload_operation(
    window: Window,
    device_state: State<'_, DeviceInfoMutex>,
    sideloader_state: State<'_, SideloaderMutex>,
    app_path: String,
) -> Result<(), AppError> {
    let op = Operation::new("sideload".to_string(), &window);
    op.start("install")?;
    op.fail_if_err(
        "install",
        sideload(device_state, sideloader_state, app_path).await,
    )?;
    op.complete("install")?;
    Ok(())
}

#[tauri::command]
pub async fn install_sidestore_operation(
    handle: AppHandle,
    window: Window,
    device_state: State<'_, DeviceInfoMutex>,
    sideloader_state: State<'_, SideloaderMutex>,
    nightly: bool,
    live_container: bool,
) -> Result<(), AppError> {
    let op = Operation::new("install_sidestore".to_string(), &window);
    op.start("download")?;
    // TODO: Cache & check version to avoid re-downloading
    let (filename, url) = if live_container {
        if nightly {
            (
                "LiveContainerSideStore-Nightly.ipa",
                "https://github.com/LiveContainer/LiveContainer/releases/download/nightly/LiveContainer+SideStore.ipa",
            )
        } else {
            (
                "LiveContainerSideStore.ipa",
                "https://github.com/LiveContainer/LiveContainer/releases/latest/download/LiveContainer+SideStore.ipa",
            )
        }
    } else if nightly {
        (
            "SideStore-Nightly.ipa",
            "https://github.com/SideStore/SideStore/releases/download/nightly/SideStore.ipa",
        )
    } else {
        (
            "SideStore.ipa",
            "https://github.com/SideStore/SideStore/releases/latest/download/SideStore.ipa",
        )
    };

    let dest = handle
        .path()
        .temp_dir()
        .map_err(|e| AppError::Filesystem("Failed to get temp dir".into(), e.to_string()))?
        .join(filename);
    op.fail_if_err("download", download(url, &dest).await)?;
    op.move_on("download", "install")?;
    let device = {
        let device_guard = device_state.lock().unwrap();
        match &*device_guard {
            Some(d) => d.clone(),
            None => return op.fail("install", AppError::NoDeviceSelected),
        }
    };
    op.fail_if_err(
        "install",
        sideload(
            device_state,
            sideloader_state,
            dest.to_string_lossy().to_string(),
        )
        .await,
    )?;
    op.move_on("install", "pairing")?;
    let sidestore_info = op.fail_if_err(
        "pairing",
        get_sidestore_info(&device.info, live_container).await,
    )?;
    if let Some(info) = sidestore_info {
        let mut usbmuxd = op.fail_if_err("pairing", get_usbmuxd().await)?;

        let provider = op.fail_if_err(
            "pairing",
            get_provider_from_connection(&device.info, &mut usbmuxd).await,
        )?;

        op.fail_if_err(
            "pairing",
            place_file(device.pairing, &provider, info.bundle_id, info.path).await,
        )?;
    } else {
        return op.fail(
            "pairing",
            AppError::HouseArrest(
                "SideStore's not found".into(),
                "The device did not report SideStore's bundle ID as installed".into(),
            ),
        );
    }

    op.complete("pairing")?;
    Ok(())
}

// LiveContainer bundled variant configuration.
#[cfg(feature = "lc")]
const STORE_APP_NAME: &str = "LiveContainer";
#[cfg(feature = "lc")]
const LC_PAIRING_PATH: &str =
    "SideStore/Documents/ALTPairingFile.mobiledevicepairing;SideStore/Documents/PairingFile_RemoteRP.plist;SideStore/Documents/PairingFile_Lockdown.plist";

// Standard spanani Store download configuration.
#[cfg(not(feature = "lc"))]
const STORE_APP_NAME: &str = "spanani Store";

#[tauri::command]
pub async fn install_spanani_store_operation(
    handle: AppHandle,
    window: Window,
    device_state: State<'_, DeviceInfoMutex>,
    sideloader_state: State<'_, SideloaderMutex>,
) -> Result<(), AppError> {
    let op = Operation::new("install_spanani_store".to_string(), &window);
    op.start("download")?;

    #[cfg(feature = "lc")]
    let dest = {
        let dest = handle
            .path()
            .resource_dir()
            .map_err(|e| AppError::Filesystem("Failed to get resource dir".into(), e.to_string()))?
            .join("LiveContainer+spanani.ipa");
        op.fail_if_err(
            "download",
            tokio::fs::metadata(&dest)
                .await
                .map_err(|e| AppError::Filesystem("Bundled IPA missing".into(), e.to_string())),
        )?;
        dest
    };
    #[cfg(not(feature = "lc"))]
    let dest = {
        let filename = "SpananiStore.ipa";
        let url = "https://github.com/spananide/spanani-store/releases/latest/download/SpananiStore.ipa";

        let dest = handle
            .path()
            .temp_dir()
            .map_err(|e| AppError::Filesystem("Failed to get temp dir".into(), e.to_string()))?
            .join(filename);
        op.fail_if_err("download", download(url, &dest).await)?;
        dest
    };
    op.move_on("download", "install")?;
    let device = {
        let device_guard = device_state.lock().unwrap();
        match &*device_guard {
            Some(d) => d.clone(),
            None => return op.fail("install", AppError::NoDeviceSelected),
        }
    };
    op.fail_if_err(
        "install",
        sideload(
            device_state,
            sideloader_state,
            dest.to_string_lossy().to_string(),
        )
        .await,
    )?;
    op.move_on("install", "pairing")?;
    let spanani_info = op.fail_if_err(
        "pairing",
        get_app_info_by_name(&device.info, STORE_APP_NAME).await,
    )?;
    if let Some(info) = spanani_info {
        let mut usbmuxd = op.fail_if_err("pairing", get_usbmuxd().await)?;

        let provider = op.fail_if_err(
            "pairing",
            get_provider_from_connection(&device.info, &mut usbmuxd).await,
        )?;

        #[cfg(feature = "lc")]
        let pairing_path = LC_PAIRING_PATH.to_string();
        #[cfg(not(feature = "lc"))]
        let pairing_path = info.path;

        op.fail_if_err(
            "pairing",
            place_file(device.pairing, &provider, info.bundle_id, pairing_path).await,
        )?;
    } else {
        return op.fail(
            "pairing",
            AppError::HouseArrest(
                format!("{STORE_APP_NAME} not found"),
                format!("The device did not report the {STORE_APP_NAME} as installed"),
            ),
        );
    }

    op.complete("pairing")?;
    Ok(())
}

pub async fn download(url: impl AsRef<str>, dest: &PathBuf) -> Result<(), AppError> {
    let response = reqwest::get(url.as_ref())
        .await
        .map_err(|e| AppError::Download(e.to_string()))?;
    if !response.status().is_success() {
        return Err(AppError::Download(format!(
            "Failed to download file: HTTP {}",
            response.status()
        )));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| AppError::Download(e.to_string()))?;
    tokio::fs::write(dest, &bytes).await.map_err(|e| {
        AppError::Filesystem("Failed to write downloaded file".into(), e.to_string())
    })?;

    Ok(())
}
