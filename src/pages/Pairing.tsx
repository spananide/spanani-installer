import "./Certificates.css";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useError } from "../ErrorContext";
import { useDialog } from "../DialogContext";
import { useTranslation } from "react-i18next";
import { FaArrowsRotate, FaShareNodes, FaDownload } from "react-icons/fa6";

type PairingAppInfo = {
  name: string;
  bundleId: string;
  path: string;
};

export const Pairing = () => {
  const { t } = useTranslation();
  const [apps, setApps] = useState<PairingAppInfo[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [failed, setFailed] = useState<boolean>(false);
  const loadingRef = useRef<boolean>(false);
  const { err } = useError();
  const { confirm } = useDialog();

  const loadApps = useCallback(async () => {
    if (loadingRef.current) return;
    const promise = async () => {
      loadingRef.current = true;
      setLoading(true);
      try {
        let list = await invoke<PairingAppInfo[]>("installed_pairing_apps");
        setApps(list);
      } catch (e) {
        setFailed(true);
        throw e;
      } finally {
        setFailed(false);
        setLoading(false);
        loadingRef.current = false;
      }
    };
    toast.promise(promise, {
      loading: t("pairing.loading_apps"),
      success: t("pairing.apps_loaded_success"),
      error: (e) => err(t("pairing.failed_load_apps"), e),
    });
  }, [setApps, t, err]);

  const pair = useCallback(
    async (app: PairingAppInfo) => {
      const promise = invoke<void>("place_pairing_cmd", {
        bundleId: app.bundleId,
        path: app.path,
      });
      toast.promise(promise, {
        loading: t("pairing.placing_pairing_file"),
        success: t("pairing.pairing_file_placed_success"),
        error: (e) => err(t("pairing.failed_place_pairing"), e),
      });
    },
    [t, err],
  );

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  return (
    <div className="certificates-page">
      <div className="section-title-wrap">
        <h2>{t("pairing.manage")}</h2>
        <button
          className="btn-refresh-icon"
          onClick={loadApps}
          disabled={loading}
          aria-label={t("common.refresh")}
        >
          <FaArrowsRotate className={loading ? "spin" : ""} /> {t("common.refresh")}
        </button>
      </div>

      {apps.length === 0 ? (
        <div className="empty-state">
          {loading
            ? t("pairing.loading_app")
            : failed
              ? t("pairing.failed_load_apps")
              : t("pairing.no_supported_apps_found")}
        </div>
      ) : (
        <div className="table-card">
          <div className="certificate-table-container">
            <table className="certificate-table">
              <thead>
                <tr className="certificate-item">
                  <th className="cert-item-part">{t("pairing.name")}</th>
                  <th className="cert-item-part">{t("pairing.bundle_id")}</th>
                  <th>{t("pairing.place_pairing_file")}</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app, i) => (
                  <tr
                    key={app.bundleId}
                    className={
                      "certificate-item" +
                      (i === apps.length - 1 ? " cert-item-last" : "")
                    }
                  >
                    <td className="cert-item-part">{app.name}</td>
                    <td className="cert-item-part font-mono">{app.bundleId}</td>
                    <td>
                      <button
                        className="primary btn-sm"
                        onClick={() => pair(app)}
                      >
                        <FaShareNodes /> {t("pairing.place")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="pairing-actions">
        {apps.length > 0 && (
          <button
            className="primary"
            onClick={() => {
              let promise = async () => {
                for (const app of apps) {
                  await invoke<void>("place_pairing_cmd", {
                    bundleId: app.bundleId,
                    path: app.path,
                  });
                }
              };
              toast.promise(promise, {
                loading: t("pairing.placing_pairing_file"),
                success: t("pairing.pairing_file_placed_success"),
                error: (e) => err(t("pairing.failed_place_pairing"), e),
              });
            }}
          >
            <FaShareNodes /> {t("pairing.place_all")}
          </button>
        )}
        <button
          onClick={() => {
            confirm(
              t("pairing.advanced_export_title"),
              t("pairing.advanced_export_message"),
              () => {
                const promise = invoke<void>("export_pairing_cmd");
                toast.promise(promise, {
                  loading: t("pairing.exporting_pairing_file"),
                  success: t("pairing.pairing_file_exported_success"),
                  error: (e) => err(t("pairing.failed_export_pairing_file"), e),
                });
              },
            );
          }}
        >
          <FaDownload /> {t("pairing.export_not_recommended")}
        </button>
      </div>
    </div>
  );
};
