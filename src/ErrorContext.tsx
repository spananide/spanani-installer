import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Modal } from "./components/Modal";
import "./ErrorContext.css";
import { toast } from "sonner";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import { useStore } from "./StoreContext";
import {
  AppError,
  ErrorVariant,
  getErrorSuggestions,
  parseLinkToken,
} from "./errors";
import { usePlatform } from "./PlatformContext";
import { FaCircleExclamation, FaCopy, FaServer } from "react-icons/fa6";

export const ErrorContext = createContext<{
  err: (msg: string, err: AppError) => string;
  setAnisetteSettingsOpener: (open: (() => void) | null) => void;
}>({ err: () => "", setAnisetteSettingsOpener: () => {} });

export const ErrorProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { t } = useTranslation();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [simpleError, setSimpleError] = useState<string | null>(null);
  const [moreDetailsOpen, setMoreDetailsOpen] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [anisetteServer] = useStore<string>(
    "anisetteServer3-1",
    "mac-ani.jkcoxson.com",
  );
  const { platform } = usePlatform();
  const anisetteSettingsOpener = useRef<(() => void) | null>(null);

  const setAnisetteSettingsOpener = useCallback(
    (open: (() => void) | null) => {
      anisetteSettingsOpener.current = open;
    },
    [],
  );

  const getSuggestions = useCallback(
    (type: ErrorVariant): string[] => {
      return getErrorSuggestions(t, type, platform, anisetteServer);
    },
    [anisetteServer, t, platform],
  );

  useEffect(() => {
    if (!error) {
      setSimpleError(null);
      setSuggestions([]);
      return;
    }
    setSuggestions(getSuggestions(error.type));
    let lines =
      error?.message.split("\n").filter((line) => line.includes("●")) ?? [];
    if (lines.length > 0) {
      setSimpleError(lines[lines.length - 1].replace(/●\s*/, "").trim());
    }
  }, [error, getSuggestions]);

  return (
    <ErrorContext.Provider
      value={{
        err: (msg: string, err: AppError) => {
          console.error(msg, err);
          setMsg(msg);
          setError(err);
          setMoreDetailsOpen(false);
          return msg;
        },
        setAnisetteSettingsOpener,
      }}
    >
      <Modal
        zIndex={999999999}
        isOpen={error !== null || msg !== null}
        close={() => {
          setError(null);
          setMsg(null);
          setMoreDetailsOpen(false);
        }}
      >
        <div className="error-outer">
          <div className="error-header">
            <div className="error-title-wrap">
              <FaCircleExclamation className="error-icon" />
              <h2>{t("error.title", { msg: msg ?? t("error.unknown") })}</h2>
            </div>
            <button
              className="error-copy-btn"
              onClick={() => {
                navigator.clipboard.writeText(
                  "```\n" +
                    (error?.message.replace(/^\n+/, "") ??
                      t("common.no_error")) +
                    "\n```",
                );
                toast.success(t("common.copied_success"));
              }}
            >
              <FaCopy /> {t("common.copy_to_clipboard")}
            </button>
          </div>
          {simpleError && <pre className="error-inner">{simpleError}</pre>}
          {simpleError && (
            <p
              className="error-more-details"
              role="button"
              tabIndex={0}
              onClick={() => setMoreDetailsOpen(!moreDetailsOpen)}
            >
              {t("common.more_details")} {moreDetailsOpen ? "▲" : "▼"}
            </p>
          )}
          {(moreDetailsOpen || !simpleError) && (
            <pre
              className={`error-inner${simpleError ? " error-details" : ""}`}
            >
              {error?.message.replace(/^\n+/, "")}
            </pre>
          )}
          {error?.type === "anisette" && anisetteSettingsOpener.current && (
            <div className="error-anisette-box">
              <p>{t("error.anisette_hint", { server: anisetteServer })}</p>
              <button
                className="primary"
                onClick={() => {
                  setError(null);
                  setMsg(null);
                  setMoreDetailsOpen(false);
                  anisetteSettingsOpener.current?.();
                }}
              >
                <FaServer /> {t("error.open_anisette_settings")}
              </button>
            </div>
          )}
          <div className="suggestions">
            {suggestions.length > 0 && (
              <h3>{t("error.suggestions_heading")}</h3>
            )}
            {suggestions.length > 0 && (
              <ul>
                {suggestions.map((s) => (
                  <li key={s}>
                    {s
                      .split(/(\(\(link:[^)]+\)\)|\(\(link:[^)]+\)\))/g)
                      .map((part, index) => {
                        const parsed = parseLinkToken(part);
                        if (parsed) {
                          const { url, text } = parsed;
                          return (
                            <span
                              key={index}
                              onClick={() => openUrl(url)}
                              role="link"
                              className="error-link"
                            >
                              {text}
                            </span>
                          );
                        }
                        return <span key={index}>{part}</span>;
                      })}
                  </li>
                ))}
              </ul>
            )}
            {error?.type !== "underage" && (
              <p className="error-support-text">
                {t("error.support_message")}
              </p>
            )}
          </div>

          <button
            className="primary"
            style={{ width: "100%", marginTop: "8px" }}
            onClick={() => {
              setError(null);
              setMsg(null);
            }}
          >
            {t("common.dismiss")}
          </button>
        </div>
      </Modal>
      {children}
    </ErrorContext.Provider>
  );
};

export const useError = () => {
  return useContext(ErrorContext);
};
