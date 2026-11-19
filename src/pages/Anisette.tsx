import "./Settings.css";
import { useStore } from "../StoreContext";
import { Dropdown } from "../components/Dropdown";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import { useError } from "../ErrorContext";
import { useDialog } from "../DialogContext";
import { useTranslation } from "react-i18next";
import { FaArrowsRotate } from "react-icons/fa6";

const anisetteServers = [
  ["mac-ani.jkcoxson.com", "Jkcoxson (Standard)"],
  ["new.ani.sidestore.io", "SideStore (.io)"],
  ["ani3.stikstore.app", "StikStore"],
];

export const Anisette = () => {
  const { t } = useTranslation();
  const [anisetteServer, setAnisetteServer] = useStore<string>(
    "anisetteServer3-1",
    "mac-ani.jkcoxson.com",
  );
  const { err } = useError();
  const { confirm } = useDialog();

  const anisetteOptions = anisetteServers.map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <div className="settings-page">
      <h2>{t("anisette.title")}</h2>
      <p className="settings-hint">{t("anisette.description")}</p>

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
      </div>
    </div>
  );
};
