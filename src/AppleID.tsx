import { useEffect, useRef, useState } from "react";
import "./AppleID.css";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { load } from "@tauri-apps/plugin-store";
import { Modal } from "./components/Modal";
import { toast } from "sonner";
import { useError } from "./ErrorContext";
import { Certificate } from "./pages/Certificates";
import { useTranslation } from "react-i18next";
import {
  FaCheck,
  FaShieldHalved,
  FaUserCheck,
  FaArrowRightFromBracket,
  FaTrashCan,
  FaKey,
  FaCircleExclamation,
  FaServer,
} from "react-icons/fa6";

const storePromise = load("data.json");

export const AppleID = ({
  loggedInAs,
  setLoggedInAs,
  noKeyringAvailable,
  anisetteServer,
  openAnisetteSettings,
  isCollapsed,
  onExpand,
  onCompleteStep,
  isDeviceSelected,
}: {
  loggedInAs: string | null;
  setLoggedInAs: (id: string | null) => void;
  noKeyringAvailable: boolean;
  anisetteServer: string;
  openAnisetteSettings: () => void;
  isCollapsed: boolean;
  onExpand: () => void;
  onCompleteStep?: () => void;
  isDeviceSelected: boolean;
}) => {
  const { t } = useTranslation();
  const [storedIds, setStoredIds] = useState<string[]>([]);
  const [forceUpdateIds, setForceUpdateIds] = useState<number>(0);
  const [emailInput, setEmailInput] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [saveCredentials, setSaveCredentials] = useState<boolean>(true);
  const [tfaOpen, setTfaOpen] = useState<boolean>(false);
  const [tfaCode, setTfaCode] = useState<string>("");
  const [addAccountOpen, setAddAccountOpen] = useState<boolean>(false);
  const [certs, setCerts] = useState<Certificate[] | null>(null);
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [chooseCertsOpen, setChooseCertsOpen] = useState<boolean>(false);
  const { err } = useError();

  useEffect(() => {
    let isMounted = true;
    const getLoggedInAs = async () => {
      try {
        const account = await invoke<string | null>("logged_in_as");
        if (isMounted) setLoggedInAs(account);
      } catch (e) {
        console.error("Failed to get logged_in_as:", e);
      }
    };
    const getStoredIds = async () => {
      try {
        const store = await storePromise;
        const ids = (await store.get<string[]>("ids")) ?? [];
        if (isMounted) setStoredIds(ids);
      } catch (e) {
        console.error("Failed to get stored ids:", e);
      }
    };

    getLoggedInAs();
    getStoredIds();

    return () => {
      isMounted = false;
    };
  }, [forceUpdateIds, setLoggedInAs]);

  useEffect(() => {
    setSelectedSerials(certs?.map((c) => c.serialNumber) ?? []);
  }, [certs]);

  const listenerAdded = useRef<boolean>(false);
  const unlisten = useRef<() => void>(() => {});

  useEffect(() => {
    if (!listenerAdded.current) {
      (async () => {
        const unlistenFn = await listen("2fa-required", () => {
          setTfaOpen(true);
        });
        unlisten.current = unlistenFn;
      })();
      listenerAdded.current = true;
    }
    return () => {
      unlisten.current();
    };
  }, []);

  const certListenerAdded = useRef<boolean>(false);
  const certUnlisten = useRef<() => void>(() => {});

  useEffect(() => {
    if (!certListenerAdded.current) {
      (async () => {
        const unlistenFn = await listen<Certificate[]>(
          "max-certs-reached",
          (certsEvent) => {
            setCerts(certsEvent.payload);
          },
        );
        certUnlisten.current = unlistenFn;
      })();
      certListenerAdded.current = true;
    }
    return () => {
      certUnlisten.current();
    };
  }, []);

  const modals = (
    <>
      {/* 2FA Modal */}
      <Modal sizeFit isOpen={tfaOpen} zIndex={2000}>
        <div className="tfa-modal-content">
          <h3>{t("apple_id.two_factor_title")}</h3>
          <p>{t("apple_id.two_factor_prompt")}</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (tfaCode.length !== 6) {
                toast.warning(t("apple_id.valid_6digit"));
                return;
              }
              await emit("2fa-recieved", tfaCode);
              setTfaOpen(false);
              setTfaCode("");
            }}
          >
            <input
              type="text"
              className="tfa-code-input"
              maxLength={6}
              placeholder="123456"
              value={tfaCode}
              onChange={(e) => setTfaCode(e.target.value.trim())}
              autoFocus
            />
            <div className="tfa-actions">
              <button type="submit" className="primary">
                {t("apple_id.submit")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTfaOpen(false);
                  setTfaCode("");
                }}
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Max Certs Modal */}
      <Modal sizeFit isOpen={certs !== null} zIndex={2000}>
        <div className="certs-modal-content">
          <h3>{t("apple_id.max_certs_title")}</h3>
          <p>{t("apple_id.max_certs_desc")}</p>
          <button
            type="button"
            className="link-button"
            onClick={() => setChooseCertsOpen((v) => !v)}
          >
            {chooseCertsOpen
              ? t("apple_id.hide_certificate_list")
              : t("apple_id.choose_what_to_revoke")}
          </button>

          {chooseCertsOpen && certs && (
            <div className="certs-list-box">
              {certs.map((cert) => (
                <label key={cert.serialNumber} className="cert-choice-item">
                  <input
                    type="checkbox"
                    checked={selectedSerials.includes(cert.serialNumber)}
                    onChange={() => {
                      setSelectedSerials((prev) =>
                        prev.includes(cert.serialNumber)
                          ? prev.filter((s) => s !== cert.serialNumber)
                          : [...prev, cert.serialNumber],
                      );
                    }}
                  />
                  <span>
                    {cert.name} ({cert.machineName})
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="modal-btn-row">
            <button
              className="primary"
              onClick={async () => {
                await emit(
                  "max-certs-response",
                  selectedSerials.length > 0 ? selectedSerials : null,
                );
                setCerts(null);
                setChooseCertsOpen(false);
              }}
            >
              {t("apple_id.continue")}
            </button>
            <button
              onClick={async () => {
                await emit("max-certs-response", null);
                setCerts(null);
                setChooseCertsOpen(false);
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );

  // Collapsed summary view
  if (isCollapsed && loggedInAs) {
    return (
      <>
        <div className="step-card is-collapsed" onClick={onExpand} role="button" tabIndex={0}>
          <div className="collapsed-left">
            <div className="step-badge-done">
              <FaCheck />
            </div>
            <span className="step-collapsed-title">
              {t("flow.step2_badge")}. {t("flow.step2_title")}
            </span>
          </div>

          <div className="collapsed-center">
            <span className="detected-pill">
              <FaUserCheck />
              <span>{loggedInAs}</span>
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
              {t("flow.step2_change")}
            </button>
          </div>
        </div>
        {modals}
      </>
    );
  }

  // Active expanded view
  return (
    <div className="step-card is-active">
      <div className="step-card-header">
        <div className="step-badge active">{t("flow.step2_badge")}</div>
        <div className="step-title-group">
          <h3>{t("flow.step2_title")}</h3>
          <p className="step-subtitle">{t("flow.step2_subtitle")}</p>
        </div>
      </div>

      <div className="step-card-body">
        {/* Privacy Note */}
        <div className="privacy-badge">
          <FaShieldHalved className="privacy-icon" />
          <span>{t("flow.step2_privacy")}</span>
        </div>

        {!isDeviceSelected && (
          <div className="hint-banner warning" style={{ marginBottom: "14px" }}>
            {t("flow.step2_require_device_first")}
          </div>
        )}

        {/* Currently Logged In Card */}
        {loggedInAs && (
          <div className="logged-in-box">
            <div className="logged-in-info">
              <span className="logged-in-label">{t("flow.step2_logged_in_as")}</span>
              <strong className="logged-in-email">{loggedInAs}</strong>
            </div>

            <div className="logged-in-actions">
              <button
                type="button"
                className="danger"
                onClick={async () => {
                  const promise = async () => {
                    await invoke("invalidate_account");
                    setForceUpdateIds((v) => v + 1);
                    setLoggedInAs(null);
                  };
                  toast.promise(promise, {
                    loading: t("apple_id.signing_out"),
                    error: (e) => err(t("apple_id.sign_out_failed"), e),
                    success: t("apple_id.signed_out_success"),
                  });
                }}
              >
                <FaArrowRightFromBracket />
                <span>{t("flow.step2_sign_out")}</span>
              </button>

              {onCompleteStep && (
                <button
                  type="button"
                  className="primary"
                  onClick={onCompleteStep}
                >
                  <span>{t("apple_id.continue")}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stored Accounts List */}
        {!loggedInAs && storedIds.length > 0 && !noKeyringAvailable && !addAccountOpen && (
          <div className="stored-accounts-section">
            <h4 className="section-small-title">{t("flow.step2_stored_logins")}</h4>
            <div className="stored-accounts-list">
              {storedIds.map((id) => (
                <div key={id} className="stored-account-row">
                  <div className="stored-account-email">
                    <FaKey className="key-icon" />
                    <span>{id}</span>
                  </div>

                  <div className="stored-account-actions">
                    <button
                      type="button"
                      className="primary btn-sm"
                      onClick={() => {
                        const promise = async () => {
                          await invoke("login_stored", {
                            email: id,
                            anisetteServer,
                          });
                          setForceUpdateIds((v) => v + 1);
                          setLoggedInAs(id);
                          if (onCompleteStep) onCompleteStep();
                        };
                        toast.promise(promise, {
                          loading: t("apple_id.logging_in"),
                          success: t("apple_id.logged_in_success"),
                          error: (e) => err(t("apple_id.login_failed"), e),
                        });
                      }}
                    >
                      {t("apple_id.sign_in")}
                    </button>

                    <button
                      type="button"
                      className="danger btn-sm"
                      onClick={async () => {
                        const promise = async () => {
                          await invoke("delete_account", { email: id });
                          setForceUpdateIds((v) => v + 1);
                        };
                        toast.promise(promise, {
                          loading: t("apple_id.deleting"),
                          error: (e) => err(t("apple_id.deletion_failed"), e),
                          success: t("apple_id.deleted_success"),
                        });
                      }}
                    >
                      <FaTrashCan />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn-use-other"
              onClick={() => setAddAccountOpen(true)}
            >
              {t("flow.step2_use_other")}
            </button>
          </div>
        )}

        {/* New Login Form */}
        {!loggedInAs && (storedIds.length === 0 || noKeyringAvailable || addAccountOpen) && (
          <form
            className="apple-login-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!emailInput || !passwordInput) {
                toast.warning(t("apple_id.enter_email_password"));
                return;
              }
              const promise = async () => {
                await invoke("login_new", {
                  email: emailInput,
                  password: passwordInput,
                  saveCredentials: saveCredentials && !noKeyringAvailable,
                  anisetteServer,
                });
                setForceUpdateIds((v) => v + 1);
                setLoggedInAs(emailInput);
                setAddAccountOpen(false);
                if (onCompleteStep) onCompleteStep();
              };
              toast.promise(promise, {
                loading: t("apple_id.logging_in"),
                success: t("apple_id.logged_in_success"),
                error: (e) => err(t("apple_id.login_failed"), e),
              });
            }}
          >
            <div className="input-field">
              <label htmlFor="apple-email">{t("flow.step2_title")} E-Mail</label>
              <input
                id="apple-email"
                type="text"
                autoComplete="username"
                placeholder={t("apple_id.email_placeholder")}
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
            </div>

            <div className="input-field">
              <label htmlFor="apple-password">Passwort</label>
              <input
                id="apple-password"
                type="password"
                autoComplete="current-password"
                placeholder={t("apple_id.password_placeholder")}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
            </div>

            {noKeyringAvailable ? (
              <p className="keyring-warning-text">
                <FaCircleExclamation />
                <span>{t("apple_id.no_keyring_available")}</span>
              </p>
            ) : (
              <label className="save-credentials-label">
                <input
                  type="checkbox"
                  checked={saveCredentials}
                  onChange={(e) => setSaveCredentials(e.target.checked)}
                />
                <span>{t("apple_id.save_credentials")}</span>
              </label>
            )}

            <p className="anisette-server-line">
              <FaServer />
              <span>
                {t("apple_id.anisette_server_label", { server: anisetteServer })}
              </span>
              <button
                type="button"
                className="link-button"
                onClick={openAnisetteSettings}
              >
                {t("apple_id.change_anisette")}
              </button>
            </p>

            <div className="form-actions">
              <button type="submit" className="primary btn-large">
                {t("flow.step2_login_button")}
              </button>
              {addAccountOpen && storedIds.length > 0 && !noKeyringAvailable && (
                <button
                  type="button"
                  onClick={() => setAddAccountOpen(false)}
                >
                  {t("common.cancel")}
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {modals}
    </div>
  );
};
