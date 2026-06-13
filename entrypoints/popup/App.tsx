import { useEffect, useMemo, useState } from "react";
import { browser } from "wxt/browser";
import {
  DEFAULT_GUTCHAIN_SETTINGS,
  type GutchainSettings,
  normalizeGutchainSettings,
} from "../../src/lib/gutchain";
import {
  GUTCHAIN_MESSAGE,
  GUTCHAIN_SETTINGS_STORAGE_KEY,
  type PopupShareResponse,
  type PopupStateResponse,
} from "../../src/lib/messages";

type StatusTone = "idle" | "working" | "success" | "error";
type WorkingTarget = "xhs" | "wechat" | null;

interface Status {
  tone: StatusTone;
  text: string;
}

const SHARE_BUTTON_CLASS =
  "inline-flex min-h-[42px] items-center justify-center rounded-lg border-0 px-4 text-[15px] font-[750] text-white transition-colors disabled:cursor-not-allowed disabled:bg-[#c9c8c4] disabled:text-[#70706c]";

const STATUS_CLASS_BY_TONE: Record<StatusTone, string> = {
  idle: "bg-[#efefea] text-[#343434]",
  working: "bg-[#fff3d8] text-[#624507]",
  success: "bg-[#dcf3e1] text-[#176330]",
  error: "bg-[#fde2e1] text-[#8a1f1b]",
};

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
          throw new Error(
            "Gutchain background did not respond. Reload the extension and try again.",
          );
        }

        const nextState = response;
        const savedSettings = storage[GUTCHAIN_SETTINGS_STORAGE_KEY] as
          | GutchainSettings
          | undefined;

        setState(nextState);
        setSettings(normalizeGutchainSettings(savedSettings));
        setStatus({
          tone: nextState.isSupported ? "idle" : "error",
          text: nextState.isSupported
            ? "Ready to share this post."
            : (nextState.reason ?? "This page is not supported."),
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

  async function openOptionsPage() {
    await browser.runtime.openOptionsPage();
  }

  return (
    <main className="flex min-h-[242px] flex-col gap-3.5 bg-[#f7f7f4] p-[18px] text-[#121417]">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-bold leading-none text-[#6f5c35] uppercase">Gutchain</p>
          <h1 className="m-0 text-[21px] font-extrabold leading-[1.1] text-[#171717]">
            Share X Post
          </h1>
        </div>
        <button
          className="min-h-[30px] flex-none cursor-pointer rounded-lg border border-[#d7d3c8] bg-[#fffdf8] px-2.5 text-xs font-[750] text-[#4d4433] transition-colors hover:border-[#b8ad94] hover:bg-[#fff7e8]"
          onClick={openOptionsPage}
          type="button"
        >
          Settings
        </button>
      </header>

      <div className="grid gap-2.5">
        <button
          className={`${SHARE_BUTTON_CLASS} bg-[#e42d48] hover:enabled:bg-[#c91f3a]`}
          disabled={!canShare}
          onClick={handleShareToXhs}
          type="button"
        >
          {workingTarget === "xhs" ? "Opening XHS..." : "Share to XHS"}
        </button>

        <button
          className={`${SHARE_BUTTON_CLASS} bg-[#147a45] hover:enabled:bg-[#0f6739]`}
          disabled={!canShare}
          onClick={handleShareToWechat}
          type="button"
        >
          {workingTarget === "wechat" ? "Opening WeChat..." : "Share to WeChat"}
        </button>
      </div>

      <label
        className={`flex min-h-7 items-center gap-2 text-[13px] font-[650] ${
          status.tone === "working" ? "text-[#898985]" : "text-[#3a3a37]"
        }`}
      >
        <input
          checked={settings.includeAuthorInBody}
          className="m-0 size-4 accent-[#e42d48]"
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

      <p
        className={`min-h-[38px] rounded-lg p-2.5 text-[13px] leading-[1.35] ${STATUS_CLASS_BY_TONE[status.tone]}`}
      >
        {status.text}
      </p>
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
