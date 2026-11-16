import "./Certificates.css";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useError } from "../ErrorContext";
import { useTranslation } from "react-i18next";
import { FaArrowsRotate, FaTriangleExclamation } from "react-icons/fa6";

export type Certificate = {
  name: string;
  certificateId: string;
  serialNumber: string;
  machineName: string;
  machineId: string;
};

export const Certificates = () => {
  const { t } = useTranslation();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const loadingRef = useRef<boolean>(false);
  const { err } = useError();

  const loadCertificates = useCallback(async () => {
    if (loadingRef.current) return;
    const promise = async () => {
      loadingRef.current = true;
      setLoading(true);
      let certs = await invoke<Certificate[]>("get_certificates");
      setCertificates(certs);
      setLoading(false);
      loadingRef.current = false;
    };
    toast.promise(promise, {
      loading: t("certificates.loading"),
      success: t("certificates.loaded_success"),
      error: (e) => err(t("certificates.failed_load"), e),
    });
  }, [setCertificates, t, err]);

  const revokeCertificate = useCallback(
    async (serialNumber: string) => {
      const promise = invoke<void>("revoke_certificate", {
        serialNumber,
      });
      promise.then(loadCertificates);
      toast.promise(promise, {
        loading: t("certificates.revoking"),
        success: t("certificates.revoked_success"),
        error: (e) => err(t("certificates.failed_revoke"), e),
      });
    },
    [loadCertificates, t, err],
  );

  useEffect(() => {
    loadCertificates();
  }, [loadCertificates]);

  return (
    <div className="certificates-page">
      <div className="section-title-wrap">
        <h2>{t("certificates.manage")}</h2>
        <button
          className="btn-refresh-icon"
          onClick={loadCertificates}
          disabled={loading}
          aria-label={t("common.refresh")}
        >
          <FaArrowsRotate className={loading ? "spin" : ""} /> {t("common.refresh")}
        </button>
      </div>

      <div className="hint-banner warning">
        <FaTriangleExclamation />
        <span>{t("tools.certificates_hint")}</span>
      </div>

      {certificates.length === 0 ? (
        <div className="empty-state">
          {loading ? t("certificates.loading") : t("certificates.none_found")}
        </div>
      ) : (
        <div className="table-card">
          <div className="certificate-table-container">
            <table className="certificate-table">
              <thead>
                <tr className="certificate-item">
                  <th className="cert-item-part">{t("certificates.name")}</th>
                  <th className="cert-item-part">{t("certificates.serial_number")}</th>
                  <th className="cert-item-part">{t("certificates.machine_name")}</th>
                  <th className="cert-item-part">{t("certificates.machine_id")}</th>
                  <th>{t("certificates.revoke")}</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert, i) => (
                  <tr
                    key={cert.certificateId}
                    className={
                      "certificate-item" +
                      (i === certificates.length - 1 ? " cert-item-last" : "")
                    }
                  >
                    <td className="cert-item-part">{cert.name}</td>
                    <td className="cert-item-part font-mono">{cert.serialNumber}</td>
                    <td className="cert-item-part">{cert.machineName}</td>
                    <td className="cert-item-part font-mono">{cert.machineId}</td>
                    <td>
                      <button
                        className="danger btn-sm"
                        onClick={() => revokeCertificate(cert.serialNumber)}
                      >
                        {t("certificates.revoke")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
