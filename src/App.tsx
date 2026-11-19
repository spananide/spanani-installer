import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import "./theme.css";
import { AppleID } from "./AppleID";
import { Device, DeviceInfo } from "./Device";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { usePlatform } from "./PlatformContext";
import {
  installSpananiStoreOperation,
  sideloadOperation,
  Operation,
  OperationState,
  OperationUpdate,
} from "./components/operations";
import OperationView from "./components/OperationView";
import { ToolsModal, TabType } from "./components/ToolsModal";
import { AboutModal } from "./components/AboutModal";
import { checkForUpdates } from "./update";
import { ErrorVariant, getErrorSuggestions, parseLinkToken } from "./errors";
import { useStore } from "./StoreContext";
import { useError } from "./ErrorContext";
import mark3d from "./assets/mark3d.png";
import banner3d from "./assets/banner3d.png";
import {
  FaGear,
  FaCheck,
  FaDownload,
  FaCircleCheck,
  FaCircleExclamation,
  FaCopy,
  FaArrowsRotate,
  FaCircleInfo,
  FaServer,
} from "react-icons/fa6";

export default function App() {
  const { t } = useTranslation();
  const { platform } = usePlatform();

  const [operationState, setOperationState] = useState<OperationState | null>(null);
  const [loggedInAs, setLoggedInAs] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [version, setVersion] = useState<string>("");
  const [stepOverride, setStepOverride] = useState<number | null>(null);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [toolsTab, setToolsTab] = useState<TabType>("sideload");
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [noKeyringAvailable, setNoKeyringAvailable] = useState<boolean>(false);
  const [anisetteServer] = useStore<string>(
    "anisetteServer3-1",
    "mac-ani.jkcoxson.com",
  );

  const { setAnisetteSettingsOpener } = useError();

  const refreshDevicesRef = useRef<(() => void) | null>(null);
  const mockAutoStartFired = useRef(false);

  const checkKeyring = useCallback(async () => {
    try {
      const available = await invoke<boolean>("keyring_available");
      setNoKeyringAvailable(!available);
    } catch (e) {
      console.error("Unable to check keyring availability:", e);
      setNoKeyringAvailable(true);
    }
  }, []);

  useEffect(() => {
    checkKeyring();
  }, [checkKeyring]);

  const openAnisetteSettings = useCallback(() => {
    setToolsTab("anisette");
    setIsToolsOpen(true);
  }, []);

  useEffect(() => {
    setAnisetteSettingsOpener(openAnisetteSettings);
    return () => setAnisetteSettingsOpener(null);
  }, [openAnisetteSettings, setAnisetteSettingsOpener]);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const v = await getVersion();
        setVersion(v);
      } catch (e) {
        console.error("Failed to get version:", e);
        setVersion("2.4.2");
      }
    };
    fetchVersion();
  }, []);

  useEffect(() => {
    checkForUpdates();
  }, []);

  // Handle URL mock state queries (?state=tools, ?state=installing, etc.)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlState = new URLSearchParams(window.location.search).get("state");
    if (urlState === "tools") {
      setIsToolsOpen(true);
    }
  }, []);

  const shortcutLabel = useCallback(
    (mac: string, windows: string, linux?: string) => {
      if (platform === "mac") return mac;
      if (platform === "linux") return linux ?? windows;
      return windows;
    },
    [platform],
  );

  const startOperation = useCallback(
    async (
      operation: Operation,
      params: Record<string, any>,
    ): Promise<void> => {
      setOperationState({
        current: operation,
        started: [],
        failed: [],
        completed: [],
      });
      return new Promise<void>(async (resolve, reject) => {
        const unlistenFn = await listen<OperationUpdate>(
          "operation_" + operation.id,
          (event) => {
            setOperationState((old) => {
              if (old == null) return null;
              if (event.payload.updateType === "started") {
                return {
                  ...old,
                  started: [...old.started, event.payload.stepId],
                };
              } else if (event.payload.updateType === "finished") {
                return {
                  ...old,
                  completed: [...old.completed, event.payload.stepId],
                };
              } else if (event.payload.updateType === "failed") {
                return {
                  ...old,
                  failed: [
                    ...old.failed,
                    {
                      stepId: event.payload.stepId,
                      extraDetails: event.payload.extraDetails,
                    },
                  ],
                };
              }
              return old;
            });
          },
        );
        try {
          await invoke(operation.id + "_operation", params);
          unlistenFn();
          resolve();
        } catch (e) {
          unlistenFn();
          reject(e);
        }
      });
    },
    [],
  );

  // Trigger mock operation if URL query ?state=installing, done, or error
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlState = new URLSearchParams(window.location.search).get("state");
    if (
      (urlState === "installing" || urlState === "done" || urlState === "error") &&
      selectedDevice &&
      loggedInAs &&
      !operationState &&
      !mockAutoStartFired.current
    ) {
      mockAutoStartFired.current = true;
      startOperation(installSpananiStoreOperation, {}).catch((e) => {
        console.log("Mock auto-start operation finished with error:", e);
      });
    }
  }, [selectedDevice, loggedInAs, operationState, startOperation]);

  // Derived active step logic
  const derivedStep = !selectedDevice ? 1 : !loggedInAs ? 2 : 3;
  const activeStep = stepOverride ?? derivedStep;

  // Operation state analysis for Step 3
  const isSpananiOp = operationState?.current.id === "install_spanani_store";
  const opFailed = (operationState?.failed.length ?? 0) > 0;
  const opDone =
    isSpananiOp &&
    operationState !== null &&
    ((opFailed &&
      operationState.started.length ===
        operationState.completed.length + operationState.failed.length) ||
      operationState.completed.length === operationState.current.steps.length);

  const dragDropStateRef = useRef({
    selectedDevice,
    loggedInAs,
    operationState,
    opDone,
  });

  useEffect(() => {
    dragDropStateRef.current = {
      selectedDevice,
      loggedInAs,
      operationState,
      opDone,
    };
  });

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let unlisten: (() => void) | undefined;
    let isMounted = true;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === "enter" || payload.type === "over") {
          setIsDragging(true);
        } else if (payload.type === "leave") {
          setIsDragging(false);
        } else if (payload.type === "drop") {
          setIsDragging(false);
          const paths = payload.paths;
          const ipaPath = paths.find((p) => p.toLowerCase().endsWith(".ipa"));
          if (!ipaPath) {
            toast.error(t("app.drop_ipa_only"));
            return;
          }
          const state = dragDropStateRef.current;
          if (!state.selectedDevice) {
            toast.error(t("app.must_select_device"));
            setStepOverride(1);
            return;
          }
          if (!state.loggedInAs) {
            toast.error(t("app.must_be_logged_in"));
            setStepOverride(2);
            return;
          }
          if (state.operationState !== null && !state.opDone) {
            return;
          }
          startOperation(sideloadOperation, { appPath: ipaPath }).catch(console.error);
        }
      })
      .then((unlistenFn) => {
        if (isMounted) {
          unlisten = unlistenFn;
        } else {
          unlistenFn();
        }
      });

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, [startOperation, t]);

  const getSuggestions = useCallback(
    (type: ErrorVariant): string[] => {
      return getErrorSuggestions(t, type, platform, anisetteServer);
    },
    [anisetteServer, t, platform],
  );

  const failedError = operationState?.failed[0];
  const suggestions = failedError
    ? getSuggestions(failedError.extraDetails.type)
    : [];

  const handleInstallClick = () => {
    if (!selectedDevice) {
      toast.error(t("app.must_select_device"));
      setStepOverride(1);
      return;
    }
    if (!loggedInAs) {
      toast.error(t("app.must_be_logged_in"));
      setStepOverride(2);
      return;
    }
    startOperation(installSpananiStoreOperation, {}).catch((e) => {
      console.error("Installation failed:", e);
    });
  };

  return (
    <div className="app-layout">
      {/* Top Bar */}
      <header className="top-bar">
        <div className="brand-group">
          <div className="brand-chip">
            <img src={mark3d} alt="spanani" className="brand-mark-img" />
          </div>
          <div className="brand-wordmark">
            <span className="brand-name">spanani</span>
            <span className="brand-tag">Installer</span>
          </div>
        </div>

        <div className="top-bar-actions">
          <button
            type="button"
            className="btn-werkzeuge"
            onClick={() => setIsToolsOpen(true)}
            aria-label={t("tools.title")}
          >
            <FaGear />
            <span>{t("tools.title")}</span>
          </button>
        </div>
      </header>

      {/* Main Guided Flow Stepper */}
      <main className="main-content">
        <div className="hero-art">
          <img src={banner3d} alt="" />
        </div>

        <div className="stepper-bar">
          <div
            className={`step-indicator${selectedDevice ? " completed" : activeStep === 1 ? " active" : ""}`}
            onClick={() => {
              if (selectedDevice) setStepOverride(1);
            }}
            role={selectedDevice ? "button" : undefined}
            tabIndex={selectedDevice ? 0 : undefined}
          >
            <div className="step-indicator-badge">
              {selectedDevice ? <FaCheck /> : "1"}
            </div>
            <span className="step-indicator-label">{t("flow.step1_title")}</span>
          </div>

          <div
            className={`stepper-connector${selectedDevice ? " filled" : ""}`}
            aria-hidden="true"
          />

          <div
            className={`step-indicator${loggedInAs ? " completed" : activeStep === 2 ? " active" : ""}`}
            onClick={() => {
              if (loggedInAs || selectedDevice) setStepOverride(2);
            }}
            role={loggedInAs ? "button" : undefined}
            tabIndex={loggedInAs ? 0 : undefined}
          >
            <div className="step-indicator-badge">
              {loggedInAs ? <FaCheck /> : "2"}
            </div>
            <span className="step-indicator-label">{t("flow.step2_title")}</span>
          </div>

          <div
            className={`stepper-connector${selectedDevice && loggedInAs ? " filled" : ""}`}
            aria-hidden="true"
          />

          <div
            className={`step-indicator${opDone && !opFailed ? " completed" : activeStep === 3 ? " active" : ""}`}
            onClick={() => {
              if (selectedDevice && loggedInAs) setStepOverride(3);
            }}
            role={selectedDevice && loggedInAs ? "button" : undefined}
            tabIndex={selectedDevice && loggedInAs ? 0 : undefined}
          >
            <div className="step-indicator-badge">
              {opDone && !opFailed ? <FaCheck /> : "3"}
            </div>
            <span className="step-indicator-label">{t("flow.step3_title")}</span>
          </div>
        </div>

        {/* Guided Cards Container */}
        <div className="steps-flow-container">
          {/* Step 1: Device */}
          <Device
            selectedDevice={selectedDevice}
            setSelectedDevice={setSelectedDevice}
            isCollapsed={activeStep !== 1 && selectedDevice !== null}
            onExpand={() => setStepOverride(1)}
            onCompleteStep={() => setStepOverride(null)}
            registerRefresh={(fn) => {
              refreshDevicesRef.current = fn ?? null;
            }}
          />

          {/* Step 2: Apple-ID */}
          <AppleID
            loggedInAs={loggedInAs}
            setLoggedInAs={setLoggedInAs}
            noKeyringAvailable={noKeyringAvailable}
            anisetteServer={anisetteServer}
            openAnisetteSettings={openAnisetteSettings}
            isCollapsed={activeStep !== 2 && loggedInAs !== null}
            onExpand={() => setStepOverride(2)}
            onCompleteStep={() => setStepOverride(null)}
            isDeviceSelected={selectedDevice !== null}
          />

          {/* Step 3: Installieren */}
          <div
            className={`step-card${activeStep === 3 ? " is-active" : " is-todo"}`}
          >
            <div className="step-card-header">
              <div
                className={`step-badge${opDone && !opFailed ? " done" : activeStep === 3 ? " active" : ""}`}
              >
                {opDone && !opFailed ? <FaCheck /> : t("flow.step3_badge")}
              </div>
              <div className="step-title-group">
                <h3>{t("flow.step3_title")}</h3>
                <p className="step-subtitle">
                  {selectedDevice
                    ? t("flow.step3_ready_hint", { device: selectedDevice.name })
                    : t("flow.step3_subtitle")}
                </p>
              </div>
            </div>

            <div className="step-card-body">
              {/* Not running, idle state */}
              {!isSpananiOp && (
                <div className="install-action-wrapper">
                  {(!selectedDevice || !loggedInAs) && (
                    <p className="install-requirement-hint">
                      {t("flow.step3_disabled_hint")}
                    </p>
                  )}

                  <button
                    type="button"
                    className="primary btn-huge-install"
                    disabled={!selectedDevice || !loggedInAs}
                    onClick={handleInstallClick}
                  >
                    <FaDownload />
                    <span>{t("flow.step3_install_button")}</span>
                  </button>
                </div>
              )}

              {/* Running or finished operation */}
              {isSpananiOp && operationState && (
                <div className="operation-inline-container" aria-live="polite">
                  {/* Operation progress steps */}
                  {!opDone && (
                    <div className="op-progress-list">
                      <div className="op-running-header">
                        <div className="op-spinner-brand" />
                        <h4>{t("flow.step3_running")}</h4>
                      </div>

                      {operationState.current.steps.map((step) => {
                        const failed = operationState.failed.find(
                          (f) => f.stepId === step.id,
                        );
                        const completed = operationState.completed.includes(
                          step.id,
                        );
                        const started = operationState.started.includes(step.id);

                        return (
                          <div className="op-step-row" key={step.id}>
                            <div className="op-step-status-icon">
                              {failed && (
                                <FaCircleExclamation className="icon-error" />
                              )}
                              {!failed && completed && (
                                <FaCircleCheck className="icon-check" />
                              )}
                              {!failed && !completed && started && (
                                <div className="op-spinner-small" />
                              )}
                              {!failed && !completed && !started && (
                                <div className="icon-pending-dot" />
                              )}
                            </div>
                            <span className="op-step-label">
                              {t(step.titleKey)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Success State */}
                  {opDone && !opFailed && (
                    <div className="install-success-card">
                      <div className="success-banner-header">
                        <FaCircleCheck className="success-icon-large" />
                        <div>
                          <h4>{t("flow.step3_success_title")}</h4>
                          <p>{t("flow.step3_success_subtitle")}</p>
                        </div>
                      </div>

                      <div className="next-steps-container">
                        <h5>{t("flow.step3_next_steps_title")}</h5>
                        <ol className="next-steps-list">
                          <li>{t("flow.step3_next_step_1")}</li>
                          <li>{t("flow.step3_next_step_2")}</li>
                          <li>{t("flow.step3_next_step_3")}</li>
                        </ol>
                      </div>

                      <button
                        type="button"
                        className="primary"
                        onClick={() => setOperationState(null)}
                      >
                        {t("flow.step3_done_button")}
                      </button>
                    </div>
                  )}

                  {/* Failure State */}
                  {opDone && opFailed && (
                    <div className="install-failure-card">
                      <div className="failure-banner-header">
                        <FaCircleExclamation className="failure-icon-large" />
                        <div>
                          <h4>{t("operation.failed")}</h4>
                          <p>{failedError?.extraDetails.message}</p>
                        </div>
                      </div>

                      {suggestions.length > 0 && (
                        <div className="failure-suggestions">
                          <h5>{t("error.suggestions_heading")}</h5>
                          <ul>
                            {suggestions.map((s, index) => (
                              <li key={index}>
                                {s
                                  .split(/(\(\(link:[^)]+\)\))/g)
                                  .map((part, pIdx) => {
                                    const parsed = parseLinkToken(part);
                                    if (parsed) {
                                      return (
                                        <span
                                          key={pIdx}
                                          className="error-link"
                                          onClick={() => openUrl(parsed.url)}
                                        >
                                          {parsed.text}
                                        </span>
                                      );
                                    }
                                    return <span key={pIdx}>{part}</span>;
                                  })}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="failure-actions">
                        {failedError?.extraDetails.type === "anisette" && (
                          <button
                            type="button"
                            onClick={openAnisetteSettings}
                          >
                            <FaServer /> {t("error.open_anisette_settings")}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-copy"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              "```\n" +
                                (failedError?.extraDetails.message ??
                                  t("common.no_error")) +
                                "\n```",
                            );
                            toast.success(t("common.copied_success"));
                          }}
                        >
                          <FaCopy /> {t("flow.step3_copy_error")}
                        </button>
                        <button
                          type="button"
                          className="primary"
                          onClick={() => {
                            setOperationState(null);
                            handleInstallClick();
                          }}
                        >
                          <FaArrowsRotate /> {t("flow.step3_retry_button")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-left">
          <span className="footer-version">
            spanani Installer v{version}
          </span>
        </div>
        <div className="footer-right">
          <button
            type="button"
            className="footer-about-link"
            onClick={() => setIsAboutOpen(true)}
          >
            <FaCircleInfo />
            <span>{t("tools.footer_about")}</span>
          </button>
        </div>
      </footer>

      {/* Tools Modal */}
      <ToolsModal
        isOpen={isToolsOpen}
        close={() => setIsToolsOpen(false)}
        activeTab={toolsTab}
        setActiveTab={setToolsTab}
        version={version}
        selectedDevice={selectedDevice}
        setSelectedDevice={setSelectedDevice}
        loggedInAs={loggedInAs}
        startOperation={startOperation}
        platform={platform}
        shortcutLabel={shortcutLabel}
        checkKeyring={checkKeyring}
      />

      {/* About Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        close={() => setIsAboutOpen(false)}
        version={version}
      />

      {/* Operation View for Tools Operations (sideload, etc.) */}
      {operationState && operationState.current.id !== "install_spanani_store" && (
        <OperationView
          operationState={operationState}
          closeMenu={() => setOperationState(null)}
        />
      )}

      {isDragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-overlay-panel">
            <strong>{t("app.drop_ipa_title")}</strong>
            <span>{t("app.drop_ipa_hint")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
