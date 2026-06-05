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

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      browser.runtime.sendMessage({ type: GUTCHAIN_MESSAGE.POPUP_GET_STATE }),
      browser.storage.local.get(GUTCHAIN_SETTINGS_STORAGE_KEY),
    ])
      .then(([response, storage]) => {
        if (!isMounted) return;
        const nextState = response as PopupStateResponse;
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
    () => state.isSupported && status.tone !== "working",
    [state.isSupported, status.tone],
  );

  async function handleShare() {
    setStatus({
      tone: "working",
      text: "Capturing post and opening Xiaohongshu...",
    });

    const response = (await browser.runtime.sendMessage({
      type: GUTCHAIN_MESSAGE.POPUP_SHARE_TO_XHS,
    })) as PopupShareResponse;

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
          <h1>Share to XHS</h1>
        </div>
      </header>

      <button className="share-button" disabled={!canShare} onClick={handleShare} type="button">
        {status.tone === "working" ? "Working..." : "Share to XHS"}
      </button>

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
        <span>Add author to body</span>
      </label>

      <p className={`status status-${status.tone}`}>{status.text}</p>
    </main>
  );
}
