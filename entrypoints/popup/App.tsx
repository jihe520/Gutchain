import { useEffect, useMemo, useState } from "react";
import { browser } from "wxt/browser";

import {
  GUTCHAIN_MESSAGE,
  GUTCHAIN_SETTINGS_STORAGE_KEY,
  type PopupShareResponse,
  type PopupStateResponse,
} from "../../src/lib/messages";
import { DEFAULT_GUTCHAIN_SETTINGS, type GutchainSettings } from "../../src/lib/gutchain";

type StatusTone = "idle" | "working" | "success" | "error";
type WorkingTarget = "xhs" | "wechat" | null;

interface Status {
  tone: StatusTone;
  text: string;
}

export function App() {
  const [state, setState] = useState<PopupStateResponse>({
    isSupported: false,
    reason: "Checking current tab...",
  });
  const [status, setStatus] = useState<Status>({
    tone: "idle",
    text: "Open an X post detail page to start.",
  });
  const [settings, setSettings] = useState<GutchainSettings>(DEFAULT_GUTCHAIN_SETTINGS);
  const [workingTarget, setWorkingTarget] = useState<WorkingTarget>(null);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      browser.runtime.sendMessage({ type: GUTCHAIN_MESSAGE.POPUP_GET_STATE }),
      browser.storage.local.get(GUTCHAIN_SETTINGS_STORAGE_KEY),
    ])
      .then(([response, storage]) => {
        if (!isMounted) return;
        if (!isPopupStateResponse(response)) {
          throw new Error("Gutchain background did not respond. Reload the extension and try again.");
        }

        const nextState = response;
        const savedSettings = storage[GUTCHAIN_SETTINGS_STORAGE_KEY] as GutchainSettings | undefined;

        setState(nextState);
        setSettings({
          ...DEFAULT_GUTCHAIN_SETTINGS,
          ...savedSettings,
        });
        setStatus({
          tone: nextState.isSupported ? "idle" : "error",
          text: nextState.isSupported
            ? "Ready to share this post."
            : nextState.reason ?? "This page is not supported.",
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        setStatus({
          tone: "error",
          text: error instanceof Error ? error.message : "Unable to inspect this tab.",
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const canShare = useMemo(
    () => state.isSupported && workingTarget === null,
    [state.isSupported, workingTarget],
  );

  async function handleShareToXhs() {
    setWorkingTarget("xhs");
    setStatus({
      tone: "working",
      text: "Capturing post and opening Xiaohongshu...",
    });

    try {
      const response = await sendShareMessage(GUTCHAIN_MESSAGE.POPUP_SHARE_TO_XHS);

      if (!response.ok) {
        setStatus({
          tone: "error",
          text: response.error ?? "Share failed.",
        });
        return;
      }

      setStatus({
        tone: "success",
        text: "Draft is being filled in Xiaohongshu.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "Share failed.",
      });
    } finally {
      setWorkingTarget(null);
    }
  }

  async function handleShareToWechat() {
    setWorkingTarget("wechat");
    setStatus({
      tone: "working",
      text: "Building image and opening WeChat...",
    });

    try {
      const response = await sendShareMessage(GUTCHAIN_MESSAGE.POPUP_SHARE_TO_WECHAT);

      if (!response.ok) {
        setStatus({
          tone: "error",
          text: response.error ?? "WeChat share failed.",
        });
        return;
      }

      setStatus({
        tone: "success",
        text: "WeChat is ready to receive the image.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error instanceof Error ? error.message : "WeChat share failed.",
      });
    } finally {
      setWorkingTarget(null);
    }
  }

  async function updateSettings(nextSettings: GutchainSettings) {
    setSettings(nextSettings);
    await browser.storage.local.set({
      [GUTCHAIN_SETTINGS_STORAGE_KEY]: nextSettings,
    });
  }

  return (
    <main className="popup">
      <header className="header">
        <div>
          <p className="eyebrow">Gutchain</p>
          <h1>Share X Post</h1>
        </div>
      </header>

      <div className="action-stack">
        <button
          className="share-button primary"
          disabled={!canShare}
          onClick={handleShareToXhs}
          type="button"
        >
          {workingTarget === "xhs" ? "Opening XHS..." : "Share to XHS"}
        </button>

        <button
          className="share-button wechat"
          disabled={!canShare}
          onClick={handleShareToWechat}
          type="button"
        >
          {workingTarget === "wechat" ? "Opening WeChat..." : "Share to WeChat"}
        </button>
      </div>

      <label className="setting-row">
        <input
          checked={settings.includeAuthorInBody}
          disabled={status.tone === "working"}
          onChange={(event) =>
            void updateSettings({
              ...settings,
              includeAuthorInBody: event.currentTarget.checked,
            })
          }
          type="checkbox"
        />
        <span>Add author to XHS body</span>
      </label>

      <p className={`status status-${status.tone}`}>{status.text}</p>
    </main>
  );
}

async function sendShareMessage(type: string): Promise<PopupShareResponse> {
  const response = await browser.runtime.sendMessage({ type });

  if (isPopupShareResponse(response)) return response;

  return {
    ok: false,
    error: "Gutchain background did not respond. Reload the extension and try again.",
  };
}

function isPopupStateResponse(response: unknown): response is PopupStateResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    "isSupported" in response &&
    typeof (response as { isSupported?: unknown }).isSupported === "boolean"
  );
}

function isPopupShareResponse(response: unknown): response is PopupShareResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    "ok" in response &&
    typeof (response as { ok?: unknown }).ok === "boolean"
  );
}
