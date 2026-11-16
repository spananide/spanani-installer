import { emit } from "./event";

function getUrlState(): string {
  if (typeof window === "undefined") return "ready";
  const params = new URLSearchParams(window.location.search);
  return params.get("state") || "ready";
}

const urlState = getUrlState();

let mockLoggedInUser: string | null = ((): string | null => {
  if (urlState === "device-wait" || urlState === "device" || urlState === "apple") {
    return null;
  }
  return "matti@spanani.de";
})();

const mockDevices = [
  {
    id: 1,
    name: "Matti's iPhone",
    uuid: "00008110-001234567890",
    connectionType: "USB" as const,
    version: "27.2",
  },
];

export async function invoke<T = any>(
  cmd: string,
  args?: Record<string, any>,
): Promise<T> {
  const currentState = getUrlState();

  switch (cmd) {
    case "keyring_available":
      return true as T;

    case "logged_in_as":
      return mockLoggedInUser as T;

    case "login_new":
    case "login_stored":
      mockLoggedInUser = args?.email || "matti@spanani.de";
      return undefined as T;

    case "invalidate_account":
      mockLoggedInUser = null;
      return undefined as T;

    case "delete_account":
      return undefined as T;

    case "list_devices":
      if (currentState === "device-wait") {
        return [] as T;
      }
      return mockDevices.map((d) => ({ Ok: d })) as T;

    case "has_stored_rppairing":
      // In "device" state, do not auto-select, allow manual selection
      if (currentState === "device-wait" || currentState === "device") {
        return false as T;
      }
      return true as T;

    case "set_selected_device":
    case "cancel_pairing":
    case "force_disable_keyring":
    case "delete_stored_rppairing":
      return undefined as T;

    case "reset_anisette_state":
      return true as T;

    case "get_certificates":
      return [
        {
          name: "Apple Development: Matti (spanani)",
          certificateId: "CERT-SPANANI-01",
          serialNumber: "5A8B9C0D1E2F",
          machineName: "Matti's PC",
          machineId: "WIN-PC-01",
        },
      ] as T;

    case "revoke_certificate":
      return undefined as T;

    case "list_app_ids":
      return {
        appIds: [
          {
            appIdId: "APPID-01",
            identifier: "de.spanani.store",
            name: "spanani Store",
            features: {},
            expirationDate: "2027-12-31",
          },
        ],
        maxQuantity: 10,
        availableQuantity: 9,
      } as T;

    case "delete_app_id":
      return undefined as T;

    case "installed_pairing_apps":
      return [
        {
          name: "spanani Store",
          bundleId: "de.spanani.store",
          path: "/Applications/spanani.app",
        },
      ] as T;

    case "place_pairing_cmd":
    case "export_pairing_cmd":
      return undefined as T;

    case "install_spanani_store_operation": {
      const isErrorState = currentState === "error";
      const isInstallingState = currentState === "installing";

      return new Promise<T>((resolve, reject) => {
        // Step 1: Download
        setTimeout(() => {
          emit("operation_install_spanani_store", {
            updateType: "started",
            stepId: "download",
          });
        }, 150);

        setTimeout(() => {
          emit("operation_install_spanani_store", {
            updateType: "finished",
            stepId: "download",
          });
        }, 400);

        // Step 2: Install
        setTimeout(() => {
          emit("operation_install_spanani_store", {
            updateType: "started",
            stepId: "install",
          });
        }, 600);

        if (isInstallingState) {
          // Remain in installing state indefinitely
          return;
        }

        if (isErrorState) {
          setTimeout(() => {
            emit("operation_install_spanani_store", {
              updateType: "failed",
              stepId: "install",
              extraDetails: {
                type: "device_coms",
                message:
                  "● Lockdown-Verbindung fehlgeschlagen: Gerät hat nicht rechtzeitig geantwortet.\n● Details: Device communications timed out during installation handshake.",
              },
            });
            reject(new Error("Installation fehlgeschlagen"));
          }, 950);
          return;
        }

        // Otherwise complete Step 2 and run Step 3
        setTimeout(() => {
          emit("operation_install_spanani_store", {
            updateType: "finished",
            stepId: "install",
          });
        }, 750);

        setTimeout(() => {
          emit("operation_install_spanani_store", {
            updateType: "started",
            stepId: "pairing",
          });
        }, 850);

        setTimeout(() => {
          emit("operation_install_spanani_store", {
            updateType: "finished",
            stepId: "pairing",
          });
          resolve(undefined as T);
        }, 1000);
      });
    }

    case "install_sidestore_operation":
    case "sideload_operation":
      return undefined as T;

    default:
      console.warn(`[Mock invoke] Unhandled command: ${cmd}`, args);
      return null as T;
  }
}
