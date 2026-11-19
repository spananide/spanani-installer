import { OperationState } from "./operations";
import "./OperationView.css";
import { Modal } from "./Modal";
import {
  FaCircleExclamation,
  FaCircleCheck,
  FaCircleMinus,
  FaCopy,
} from "react-icons/fa6";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import { ErrorVariant, getErrorSuggestions, parseLinkToken } from "../errors";
import { useStore } from "../StoreContext";
import { usePlatform } from "../PlatformContext";

export default function OperationView({
  operationState,
  closeMenu,
}: {
  operationState: OperationState;
  closeMenu: () => void;
}) {
  const { t } = useTranslation();
  const operation = operationState.current;
  const opFailed = operationState.failed.length > 0;
  const done =
    (opFailed &&
      operationState.started.length ===
        operationState.completed.length + operationState.failed.length) ||
    operationState.completed.length === operation.steps.length;

  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false);
  const [anisetteServer] = useStore<string>(
    "anisetteServer3-1",
    "mac-ani.jkcoxson.com",
  );
  const { platform } = usePlatform();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [underage, setUnderage] = useState<boolean>(false);

  const getSuggestions = useCallback(
    (type: ErrorVariant): string[] => {
      return getErrorSuggestions(t, type, platform, anisetteServer);
    },
    [anisetteServer, t, platform],
  );

  useEffect(() => {
    if (operationState.failed.length > 0) {
      const suggestionSet = new Set<string>();
      for (const f of operationState.failed) {
        if (f.extraDetails.type === "underage") {
          setUnderage(true);
        }
        for (const suggestion of getSuggestions(f.extraDetails.type)) {
          suggestionSet.add(suggestion);
        }
      }
      setSuggestions([...suggestionSet]);
    }
  }, [operationState, getSuggestions]);

  return (
    <Modal
      isOpen={true}
      close={() => {
        if (done) closeMenu();
      }}
      hideClose={!done}
      sizeFit
    >
      <div className="op-view">
        <div className="op-header">
          <h2>
            {done && !opFailed && operation.successTitleKey
              ? t(operation.successTitleKey)
              : t(operation.titleKey)}
          </h2>
          <p className="op-status-text">
            {done
              ? opFailed
                ? t("operation.failed")
                : t("operation.completed")
              : t("operation.please_wait")}
          </p>
        </div>

        <div className="op-steps-list" aria-live="polite">
          {operation.steps.map((step) => {
            const failed = operationState.failed.find((f) => f.stepId === step.id);
            const completed = operationState.completed.includes(step.id);
            const started = operationState.started.includes(step.id);
            const notStarted = !failed && !completed && !started;

            const lines =
              failed?.extraDetails.message
                ?.split("\n")
                .filter((line) => line.includes("●")) ?? [];
            const errorShort =
              lines[lines.length - 1]?.replace(/●\s*/, "").trim() ?? "";

            return (
              <div className="op-step-item" key={step.id}>
                <div className="op-step-icon">
                  {failed && <FaCircleExclamation className="icon-error" />}
                  {!failed && completed && <FaCircleCheck className="icon-check" />}
                  {!failed && !completed && started && (
                    <div className="op-spinner" />
                  )}
                  {notStarted && !opFailed && <div className="icon-waiting" />}
                  {notStarted && opFailed && (
                    <FaCircleMinus className="icon-skipped" />
                  )}
                </div>

                <div className="op-step-content">
                  <p className="op-step-title">{t(step.titleKey)}</p>
                  {failed && (
                    <div className="op-error-box">
                      <pre className="op-error-pre">
                        {!errorShort
                          ? failed.extraDetails.message.replace(/^\n+/, "")
                          : errorShort}
                      </pre>
                      {errorShort !== "" && (
                        <>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => setMoreDetailsOpen(!moreDetailsOpen)}
                          >
                            {t("common.more_details")}{" "}
                            {moreDetailsOpen ? "▲" : "▼"}
                          </button>
                          {moreDetailsOpen && (
                            <pre className="op-error-pre full">
                              {failed.extraDetails.message.replace(/^\n+/, "")}
                            </pre>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {done && !opFailed && operation.successMessageKey && (
          <div className="op-success-banner">
            <p>{t(operation.successMessageKey)}</p>
          </div>
        )}

        {opFailed && done && (
          <div className="op-failure-actions">
            {suggestions.length > 0 && (
              <div className="op-suggestions">
                <h4>{t("error.suggestions_heading")}</h4>
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
              </div>
            )}
            {!underage && (
              <p className="op-support-hint">
                {t("error.support_message")}
              </p>
            )}
            <button
              className="op-action-btn"
              onClick={() => {
                navigator.clipboard.writeText(
                  "```\n" +
                    (operationState.failed[0]?.extraDetails?.message.replace(
                      /^\n+/,
                      "",
                    ) ?? t("common.no_error")) +
                    "\n```",
                );
                toast.success(t("common.copied_success"));
              }}
            >
              <FaCopy /> {t("operation.copy_error_clipboard")}
            </button>
          </div>
        )}

        {done && (
          <button className="primary" style={{ width: "100%", marginTop: "12px" }} onClick={closeMenu}>
            {t("common.dismiss")}
          </button>
        )}
      </div>
    </Modal>
  );
}
