import "./Settings.css";
import { useStore } from "../StoreContext";
import { useEffect, useState } from "react";
import { LogLevel, useLogs } from "../LogContext";
import { Modal } from "../components/Modal";
import { Dropdown } from "../components/Dropdown";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { useError } from "../ErrorContext";
import { Virtuoso } from "react-virtuoso";
import { useDialog } from "../DialogContext";
import { useTranslation } from "react-i18next";
import i18n, { sortedLanguages } from "../i18next";
import { DeviceInfo } from "../Device";
import { FaCopy, FaTrashCan, FaArrowsRotate } from "react-icons/fa6";

type SettingsProps = {
  ensureSelectedDevice: () => boolean;
  setSelectedDevice: (device: DeviceInfo | null) => void;
  platform: string;
  shortcutLabel: (mac: string, windows: string, linux?: string) => string;
  checkKeyring: () => Promise<void>;
};

const anisetteServers = [
  ["mac-ani.jkcoxson.com", "Jkcoxson (Standard)"],
  ["new.ani.sidestore.io", "SideStore (.io)"],
  ["ani3.stikstore.app", "StikStore"],
];

export const Settings = ({
  ensureSelectedDevice,
  setSelectedDevice,
  platform,
  shortcutLabel,
  checkKeyring,
}: SettingsProps) => {
  const { t } = useTranslation();
  const [anisetteServer, setAnisetteServer] = useStore<string>(
    "anisetteServer3-1",
    "mac-ani.jkcoxson.com",
  );

  const [overrideKeyring, setOverrideKeyring] = useStore<boolean>(
    "overrideKeyring",
    false,
  );
  const [logsOpen, setLogsOpen] = useState(false);
  const [logLevelFilter, setLogLevelFilter] = useState("3");
  const logs = useLogs();
  const { err } = useError();
  const { confirm } = useDialog();

  const anisetteOptions = anisetteServers.map(([value, label]) => ({
    value,
    label,
  }));
  const logLevelOptions = [
    { value: String(LogLevel.Debug), label: t("settings.debug") },
    { value: String(LogLevel.Info), label: t("settings.info") },
    { value: String(LogLevel.Warn), label: t("settings.warn") },
    { value: String(LogLevel.Error), label: t("settings.error") },
  ];
  const filteredLogs = logs.filter((log) => {
    return log.level >= Number(logLevelFilter);
  });

  const [lang, setLang] = useStore<string>("lang", "en");

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === undefined) return;
      const key = event.key.toLowerCase();
      const primaryPressed = platform === "mac" ? event.metaKey : event.ctrlKey;
      if (!primaryPressed) return;

      if (!event.shiftKey && key === "l") {
        event.preventDefault();
        setLogsOpen(true);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [platform]);

  useEffect(() => {
    (async () => {
      await invoke("force_disable_keyring", { force: overrideKeyring });
      checkKeyring();
    })();
  }, [overrideKeyring, checkKeyring]);

  return (
    <div className="settings-page">
      <h2>{t("app.settings")}</h2>

      <div className="settings-section">
        <Dropdown
          label={t("settings.anisette_server")}
          labelId="anisette-label"
          options={anisetteOptions}
          value={anisetteServer}
          onChange={setAnisetteServer}
          allowCustom
          defaultCustomValue="ani.yourserver.com"
          customPlaceholder={t("settings.custom_anisette_placeholder")}
          customLabel={t("settings.custom_anisette")}
          customToggleLabel={t("settings.use_custom_anisette")}
          presetToggleLabel={t("settings.back_preset_servers")}
        />
      </div>

      <div className="settings-section">
        <Dropdown
          label={t("app.language")}
          labelId="language"
          options={sortedLanguages.map(([value, label]) => ({
            value,
            label,
          }))}
          value={lang}
          onChange={setLang}
        />
      </div>

      <div className="settings-section toggle-setting">
        <label className="settings-checkbox-label">
          <input
            type="checkbox"
            checked={overrideKeyring}
            onChange={(e) => {
              setOverrideKeyring(e.target.checked);
            }}
          />
          <span className="checkbox-title">{t("settings.dont_use_keyring")}</span>
        </label>
        <p className="settings-hint">
          {t("settings.dont_use_keyring_message")}
        </p>
      </div>

      <div className="settings-actions-group">
        <button
          className="danger"
          onClick={() =>
            confirm(
              t("settings.reset_anisette_title"),
              t("settings.reset_anisette_message"),
              () =>
                toast.promise(invoke("reset_anisette_state"), {
                  loading: t("settings.resetting_anisette_state"),
                  success: (didReset) =>
                    didReset
                      ? t("settings.anisette_state_reset_success")
                      : t("settings.anisette_state_not_found"),
                  error: (e) =>
                    err(t("settings.failed_reset_anisette_state"), e),
                }),
            )
          }
        >
          <FaArrowsRotate /> {t("settings.reset_anisette_title")}
        </button>

        <button
          className="danger"
          onClick={() => {
            if (!ensureSelectedDevice()) return;
            confirm(
              t("settings.delete_stored_rppairing"),
              t("settings.delete_stored_rppairing_message"),
              () =>
                toast.promise(
                  async () => {
                    await invoke("delete_stored_rppairing");
                    await invoke("set_selected_device");
                    setSelectedDevice(null);
                  },
                  {
                    loading: t("settings.deleting_stored_rppairing"),
                    success: t("settings.stored_rppairing_deleted_success"),
                    error: (e) =>
                      err(t("settings.failed_delete_stored_rppairing"), e),
                  },
                ),
            );
          }}
        >
          <FaTrashCan /> {t("settings.delete_stored_rppairing")}
        </button>

        <button onClick={() => setLogsOpen(true)}>
          {t("settings.view_logs")}
          <span className="text-muted">{` (${shortcutLabel("⌘L", "Ctrl+L")})`}</span>
        </button>
      </div>

      <Modal
        isOpen={logsOpen}
        close={() => setLogsOpen(false)}
        zIndex={9999999999}
      >
        <div className="log-outer">
          <div className="log-header">
            <h2>{t("settings.logs")}</h2>
            <button
              onClick={() => {
                const logText = filteredLogs
                  .map(
                    (log) =>
                      `[${log.timestamp}] [${LogLevel[log.level]}] ${log.target ? `<${log.target}>` : ""} ${log.message}`,
                  )
                  .join("\n");
                navigator.clipboard.writeText("```\n" + logText + "\n```");
                toast.success(t("common.copied_success"));
              }}
            >
              <FaCopy /> {t("common.copy_to_clipboard")}
            </button>
          </div>
          <Dropdown
            label={t("settings.log_level")}
            labelId="log-level-label"
            options={logLevelOptions}
            value={logLevelFilter}
            onChange={setLogLevelFilter}
          />
          {filteredLogs.length > 0 ? (
            <Virtuoso
              className="log-inner"
              data={filteredLogs}
              followOutput="smooth"
              initialTopMostItemIndex={filteredLogs.length - 1}
              itemContent={(_index, log) => (
                <div className="log-entry">
                  <span className="log-time">[{log.timestamp}]</span>{" "}
                  {getHtmlForLevel(log.level)}{" "}
                  {log.target && (
                    <span className="log-target">{`<${log.target}>`}</span>
                  )}{" "}
                  <span className="log-msg">{log.message}</span>
                </div>
              )}
            />
          ) : (
            <div className="log-inner empty">
              <div className="log-entry">{t("settings.no_logs_yet")}</div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

function getHtmlForLevel(level: LogLevel) {
  switch (level) {
    case LogLevel.Trace:
      return <span style={{ color: "var(--accent)" }}>[TRACE]</span>;
    case LogLevel.Debug:
      return <span style={{ color: "#7cd4fd" }}>[DEBUG]</span>;
    case LogLevel.Info:
      return <span style={{ color: "var(--success)" }}>[INFO]</span>;
    case LogLevel.Warn:
      return <span style={{ color: "var(--warning)" }}>[WARN]</span>;
    case LogLevel.Error:
      return <span style={{ color: "var(--danger)" }}>[ERROR]</span>;
    default:
      return <span>[UNKNOWN]</span>;
  }
}
