import { Modal } from "./Modal";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import markLogo from "../assets/mark.png";
import { FaArrowUpRightFromSquare } from "react-icons/fa6";
import "./AboutModal.css";

export const AboutModal = ({
  isOpen,
  close,
  version,
}: {
  isOpen: boolean;
  close: () => void;
  version: string;
}) => {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} close={close} sizeFit>
      <div className="about-modal">
        <div className="about-header">
          <div className="about-logo-chip">
            <img src={markLogo} alt="spanani" className="about-logo-img" />
          </div>
          <div className="about-title-block">
            <h3>spanani Installer</h3>
            <span className="about-version-badge">
              {t("tools.about_version", { version })}
            </span>
          </div>
        </div>

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

        <button
          className="primary"
          style={{ width: "100%", marginTop: "12px" }}
          onClick={close}
        >
          {t("common.dismiss")}
        </button>
      </div>
    </Modal>
  );
};
