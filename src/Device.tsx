import { useCallback, useEffect, useRef, useState } from "react";
import "./Device.css";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Modal } from "./components/Modal";
import { useError } from "./ErrorContext";
import { AppError } from "./errors";
import {
  FaCheck,
  FaMobileScreen,
  FaTriangleExclamation,
  FaArrowsRotate,
  FaArrowUpRightFromSquare,
} from "react-icons/fa6";

export type DeviceInfo = {
  name: string;
  id: number;
  uuid: string;
  connectionType: "USB" | "Network" | "Unknown";
  version: string;
};

export const Device = ({
  selectedDevice,
  setSelectedDevice,
  registerRefresh,
  isCollapsed,
  onExpand,
  onCompleteStep,
}: {
  selectedDevice: DeviceInfo | null;
  setSelectedDevice: (device: DeviceInfo | null) => void;
  registerRefresh?: (fn?: () => void) => void;
  isCollapsed: boolean;
  onExpand: () => void;
  onCompleteStep?: () => void;
}) => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [waitingToPair, setWaitingToPair] = useState<DeviceInfo | null>(null);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const listingDevices = useRef<boolean>(false);
  const pairingRequestId = useRef<number>(0);
  const pairingModalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { err } = useError();

  const clearPairingModalTimer = useCallback(() => {
    if (pairingModalTimer.current) {
      clearTimeout(pairingModalTimer.current);
      pairingModalTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPairingModalTimer();
    };
  }, [clearPairingModalTimer]);

  const selectDevice = useCallback(
    (device: DeviceInfo | null) => {
      const requestId = ++pairingRequestId.current;
      clearPairingModalTimer();
      setShowPairingModal(false);
      setWaitingToPair(device);

      if (device) {
        pairingModalTimer.current = setTimeout(() => {
          if (pairingRequestId.current === requestId) {
            setShowPairingModal(true);
          }
        }, 100);
      }

      invoke("set_selected_device", { device })
        .then(() => {
          if (pairingRequestId.current !== requestId) return;
          clearPairingModalTimer();
          setShowPairingModal(false);
          setWaitingToPair(null);
          setSelectedDevice(device);
          if (device && onCompleteStep) {
            onCompleteStep();
          }
        })
        .catch((e) => {
          if (pairingRequestId.current !== requestId) return;
          const message = String((e.message ?? e) ?? "Unknown error");
          if (message !== "Pairing cancelled") {
            toast.error(err(t("device.failed_select"), e));
          }
          clearPairingModalTimer();
          setShowPairingModal(false);
          setWaitingToPair(null);
        });
    },
    [clearPairingModalTimer, setSelectedDevice, onCompleteStep, t, err],
  );

  const loadDevices = useCallback(async () => {
    if (listingDevices.current) return;
    setIsSearching(true);
    const promise = new Promise<number>(async (resolve, reject) => {
      listingDevices.current = true;
      try {
        const results = await invoke<
          Array<{ Ok: DeviceInfo } | { Err: AppError }>
        >("list_devices");

        const foundDevices: DeviceInfo[] = [];
        for (const result of results) {
          if ("Ok" in result) {
            foundDevices.push(result.Ok);
          } else if ("Err" in result) {
            toast.error(err(t("device.unable_load_devices_prefix"), result.Err));
          }
        }

        setDevices(foundDevices);
        if (selectedDevice) {
          const stillAvailable = foundDevices.find(
            (d) => d.id === selectedDevice.id,
          );
          if (!stillAvailable) {
            selectDevice(null);
          }
        }

        if (foundDevices.length > 0) {
          const devicesWithPairing = await Promise.all(
            foundDevices.map(async (device) => {
              const hasPairing = await invoke<boolean>("has_stored_rppairing", {
                device,
              });
              return hasPairing ? device : null;
            }),
          )
            .catch(() => [])
            .then((res) => res.filter((d): d is DeviceInfo => d !== null));

          if (devicesWithPairing.length > 0 && !selectedDevice) {
            selectDevice(devicesWithPairing[0]);
          }
        }

        listingDevices.current = false;
        setIsSearching(false);
        resolve(foundDevices.length);
      } catch (e) {
        setDevices([]);
        selectDevice(null);
        listingDevices.current = false;
        setIsSearching(false);
        reject(e);
      }
    });

    toast.promise(promise, {
      loading: t("device.loading_devices"),
      success: (count) => {
        if (count === 0) {
          return t("device.no_devices_found");
        }
        return count > 1 ? t("device.found_devices") : t("device.found_device");
      },
      error: (e) => err(t("device.unable_load_devices_prefix"), e),
    });
  }, [selectedDevice, selectDevice, t, err]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    registerRefresh?.(loadDevices);
    return () => registerRefresh?.(undefined);
  }, [registerRefresh, loadDevices]);

  // Collapsed summary view
  if (isCollapsed && selectedDevice) {
    return (
      <div className="step-card is-collapsed" onClick={onExpand} role="button" tabIndex={0}>
        <div className="collapsed-left">
          <div className="step-badge-done">
            <FaCheck />
          </div>
          <span className="step-collapsed-title">
            {t("flow.step1_badge")}. {t("flow.step1_title")}
          </span>
        </div>

        <div className="collapsed-center">
          <span className="detected-pill">
            <FaMobileScreen />
            <span>{selectedDevice.name}</span>
            <span className="detected-version">iOS {selectedDevice.version}</span>
            <span className="detected-tag">{selectedDevice.connectionType}</span>
          </span>
        </div>

        <div className="collapsed-right">
          <button
            type="button"
            className="btn-change"
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
          >
            {t("flow.step1_change")}
          </button>
        </div>
      </div>
    );
  }

  // Active expanded view
  return (
    <div className="step-card is-active">
      <div className="step-card-header">
        <div className="step-badge active">{t("flow.step1_badge")}</div>
        <div className="step-title-group">
          <h3>{t("flow.step1_title")}</h3>
          <p className="step-subtitle">{t("flow.step1_subtitle")}</p>
        </div>
      </div>

      <div className="step-card-body">
        {/* Connection Hint Box */}
        <div className="connect-hint-card">
          <div className="hint-icon-chip">
            <FaMobileScreen />
          </div>
          <div className="hint-text">
            <strong>{t("flow.step1_subtitle")}</strong>
          </div>
        </div>

        {/* Warning Card if no device found */}
        {devices.length === 0 && !isSearching && (
          <div className="device-warning-card">
            <div className="warning-card-header">
              <FaTriangleExclamation className="warning-icon" />
              <div>
                <h4>{t("flow.step1_driver_warning_title")}</h4>
                <p>{t("flow.step1_driver_warning_desc")}</p>
              </div>
            </div>

            <div className="warning-card-actions">
              <button
                type="button"
                className="btn-itunes-link"
                onClick={async () => {
                  try {
                    await openUrl("https://www.apple.com/itunes/");
                  } catch (e) {
                    console.error("Failed to open iTunes link", e);
                  }
                }}
              >
                <span>{t("flow.step1_download_itunes")}</span>
                <FaArrowUpRightFromSquare />
              </button>
              <button
                type="button"
                className="primary"
                onClick={loadDevices}
                disabled={isSearching}
              >
                <FaArrowsRotate className={isSearching ? "spin" : ""} />
                <span>{t("flow.step1_rescan")}</span>
              </button>
            </div>
          </div>
        )}

        {/* Devices list if found */}
        {devices.length > 0 && (
          <div className="device-list">
            {devices.map((device) => {
              const isActive = selectedDevice?.id === device.id;
              return (
                <div
                  key={device.id}
                  className={`device-item-card${isActive ? " selected" : ""}`}
                  onClick={() => selectDevice(device)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="device-item-icon">
                    <FaMobileScreen />
                  </div>
                  <div className="device-item-info">
                    <span className="device-item-name">{device.name}</span>
                    <span className="device-item-sub">
                      iOS {device.version} • {device.connectionType}
                    </span>
                  </div>
                  <div className="device-item-status">
                    {isActive ? (
                      <span className="selected-tag">
                        <FaCheck /> {t("flow.step1_selected")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-sm"
                        disabled={waitingToPair !== null}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectDevice(device);
                        }}
                      >
                        {t("app.select_device")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="device-list-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={loadDevices}
                disabled={isSearching || waitingToPair !== null}
              >
                <FaArrowsRotate className={isSearching ? "spin" : ""} />
                <span>{t("flow.step1_rescan")}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pairing Modal */}
      <Modal
        isOpen={showPairingModal && waitingToPair !== null}
        close={() => {
          pairingRequestId.current += 1;
          clearPairingModalTimer();
          setShowPairingModal(false);
          invoke("cancel_pairing").catch(() => {});
          setWaitingToPair(null);
        }}
      >
        <div className="pairing-modal-content">
          <div className="pairing-spinner" />
          <h3>
            {t("device.pairing_in_progress_header", {
              device: waitingToPair?.name ?? "Gerät",
            })}
          </h3>
          <p>{t("device.pairing_in_progress_hint")}</p>
          <button
            className="danger"
            style={{ marginTop: "16px", width: "100%" }}
            onClick={async () => {
              pairingRequestId.current += 1;
              clearPairingModalTimer();
              setShowPairingModal(false);
              await invoke("cancel_pairing");
              setWaitingToPair(null);
            }}
          >
            {t("device.pairing_cancel")}
          </button>
        </div>
      </Modal>
    </div>
  );
};
