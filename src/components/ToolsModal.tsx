import { useState } from "react";
import { Modal } from "./Modal";
import { useTranslation } from "react-i18next";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { Certificates } from "../pages/Certificates";
import { AppIds } from "../pages/AppIds";
import { Pairing } from "../pages/Pairing";
import { Settings } from "../pages/Settings";
import { DeviceInfo } from "../Device";
import {
  Operation,
  sideloadOperation,
} from "./operations";
import markLogo from "../assets/mark.png";
import {
  FaFileCode,
  FaShareNodes,
  FaCertificate,
  FaKey,
  FaGear,
  FaCircleInfo,
  FaArrowUpRightFromSquare,
  FaDownload,
} from "react-icons/fa6";
import "./ToolsModal.css";

type TabType =
  | "sideload"
  | "pairing"
  | "certificates"
  | "appids"
  | "settings"
  | "about";

export const ToolsModal = ({
  isOpen,
  close,
  version,
  selectedDevice,
  setSelectedDevice,
  loggedInAs,
  startOperation,
  platform,
  shortcutLabel,
  checkKeyring,
}: {
  isOpen: boolean;
  close: () => void;
  version: string;
  selectedDevice: DeviceInfo | null;
  setSelectedDevice: (device: DeviceInfo | null) => void;
  loggedInAs: string | null;
  startOperation: (operation: Operation, params: Record<string, any>) => Promise<void>;
  platform: string;
  shortcutLabel: (mac: string, windows: string, linux?: string) => string;
  checkKeyring: () => Promise<void>;
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>("sideload");

  const ensureReady = (): boolean => {
    if (!selectedDevice) {
      toast.error(t("app.must_select_device"));
      return false;
    }
    if (!loggedInAs) {
      toast.error(t("app.must_be_logged_in"));
      return false;
    }
    return true;
  };

  const handleSideload = async () => {
    if (!ensureReady()) return;
    try {
      const path = await openFileDialog({
        multiple: false,
        filters: [{ name: t("app.ipa_files"), extensions: ["ipa"] }],
      });
      if (!path) return;
      close();
      await startOperation(sideloadOperation, { appPath: path as string });
    } catch (e) {
      console.error(e);
      toast.error("Could not open the file");
    }
  };

  return (
    <Modal isOpen={isOpen} close={close}>
      <div className="tools-container">
        <div className="tools-sidebar">
          <div className="tools-sidebar-title">
            <FaGear />
            <span>{t("tools.title")}</span>
          </div>

          <nav className="tools-nav">
            <button
              className={`tools-nav-item${activeTab === "sideload" ? " active" : ""}`}
              onClick={() => setActiveTab("sideload")}
            >
              <FaFileCode />
              <span>{t("tools.tab_sideload")}</span>
            </button>

            <button
              className={`tools-nav-item${activeTab === "pairing" ? " active" : ""}`}
              onClick={() => setActiveTab("pairing")}
            >
              <FaShareNodes />
              <span>{t("tools.tab_pairing")}</span>
            </button>

            <button
              className={`tools-nav-item${activeTab === "certificates" ? " active" : ""}`}
              onClick={() => setActiveTab("certificates")}
            >
              <FaCertificate />
              <span>{t("tools.tab_certificates")}</span>
            </button>

            <button
              className={`tools-nav-item${activeTab === "appids" ? " active" : ""}`}
              onClick={() => setActiveTab("appids")}
            >
              <FaKey />
              <span>{t("tools.tab_appids")}</span>
            </button>

            <button
              className={`tools-nav-item${activeTab === "settings" ? " active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              <FaGear />
              <span>{t("tools.tab_settings")}</span>
            </button>

            <button
              className={`tools-nav-item${activeTab === "about" ? " active" : ""}`}
              onClick={() => setActiveTab("about")}
            >
              <FaCircleInfo />
              <span>{t("tools.tab_about")}</span>
            </button>
          </nav>
        </div>

        <div className="tools-content-area">
          {activeTab === "sideload" && (
            <div className="tool-view-card">
              <h2>{t("tools.sideload_title")}</h2>
              <p className="tool-view-desc">{t("tools.sideload_desc")}</p>

              {(!selectedDevice || !loggedInAs) && (
                <div className="hint-banner warning">
                  {t("tools.sideload_device_login_required")}
                </div>
              )}

              <div className="sideload-action-box">
                <button
                  className="primary btn-large"
                  onClick={handleSideload}
                  disabled={!selectedDevice || !loggedInAs}
                >
                  <FaDownload />
                  <span>{t("tools.sideload_select_file")}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "pairing" && <Pairing />}

          {activeTab === "certificates" && <Certificates />}

          {activeTab === "appids" && <AppIds />}

          {activeTab === "settings" && (
            <Settings
              ensureSelectedDevice={ensureReady}
              setSelectedDevice={setSelectedDevice}
              platform={platform}
              shortcutLabel={shortcutLabel}
              checkKeyring={checkKeyring}
            />
          )}

          {activeTab === "about" && (
            <div className="tool-view-card about-tab-card">
              <div className="about-logo-chip">
                <img src={markLogo} alt="spanani" className="about-logo-img" />
              </div>
              <h2>spanani Installer</h2>
              <span className="about-version-badge">
                {t("tools.about_version", { version })}
              </span>

              <div className="about-body">
                <p className="about-attribution">
                  spanani Installer is based on iloader by nab138 (MIT licence).
                </p>

                <button
                  type="button"
                  className="about-github-btn"
                  onClick={async () => {
                    try {
                      await openUrl("https://github.com/nab138/iloader");
                    } catch (e) {
                      console.error("Failed to open URL", e);
                    }
                  }}
                >
                  <span>{t("tools.about_link_label")}</span>
                  <FaArrowUpRightFromSquare />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
