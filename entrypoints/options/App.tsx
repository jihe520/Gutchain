import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { browser } from "wxt/browser";
import {
  DEFAULT_GUTCHAIN_SETTINGS,
  type GutchainFramePresetId,
  type GutchainSettings,
  normalizeGutchainSettings,
} from "../../src/lib/gutchain";
import { GUTCHAIN_SETTINGS_STORAGE_KEY } from "../../src/lib/messages";

type SaveState = "idle" | "saving" | "saved" | "error";

interface FramePreset {
  id: GutchainFramePresetId;
  name: string;
  description: string;
  accent: string;
  className: string;
}

interface SocialLink {
  name: string;
  description: string;
  href: string;
  accent: string;
}

const FRAME_PRESETS: FramePreset[] = [
  {
    id: "clean",
    name: "Clean",
    description: "White card",
    accent: "#e42d48",
    className: "frame-clean",
  },
  {
    id: "xhs",
    name: "XHS Red",
    description: "Red rail",
    accent: "#e42d48",
    className: "frame-xhs",
  },
  {
    id: "wechat",
    name: "WeChat Green",
    description: "Soft green",
    accent: "#147a45",
    className: "frame-wechat",
  },
  {
    id: "ink",
    name: "Ink",
    description: "Paper edge",
    accent: "#1f1f1d",
    className: "frame-ink",
  },
];

const SOCIAL_LINKS: SocialLink[] = [
  {
    name: "官网",
    description: "gutchain.fun",
    href: "https://gutchain.fun",
    accent: "#e42d48",
  },
  {
    name: "GitHub",
    description: "Repo",
    href: "https://github.com/jihe520/Gutchain",
    accent: "#171717",
  },
  {
    name: "X",
    description: "@EqbymCi",
    href: "https://x.com/EqbymCi",
    accent: "#111111",
  },
  {
    name: "小红书",
    description: "Profile",
    href: "https://www.xiaohongshu.com/user/profile/647a0857000000002a037c03",
    accent: "#ff2442",
  },
  {
    name: "哔哩哔哩",
    description: "Bilibili",
    href: "https://space.bilibili.com/400340982",
    accent: "#00a1d6",
  },
];

const EYEBROW_CLASS = "mb-[5px] text-xs font-extrabold leading-none text-[#6f5c35] uppercase";
const HEADING_CLASS = "m-0 font-[820] text-[#171717]";
const SAVE_BADGE_CLASS =
  "inline-flex min-h-7 items-center whitespace-nowrap rounded-full border px-2.5 text-xs font-[780]";

const SAVE_BADGE_CLASS_BY_STATE: Record<SaveState, string> = {
  idle: "border-[#dcd8ce] bg-[#fffdf8] text-[#5d574a]",
  saving: "border-[#e9cf88] bg-[#fff3d8] text-[#624507]",
  saved: "border-[#aad7b5] bg-[#dcf3e1] text-[#176330]",
  error: "border-[#f1b5b2] bg-[#fde2e1] text-[#8a1f1b]",
};

export function App() {
  const [settings, setSettings] = useState<GutchainSettings>(DEFAULT_GUTCHAIN_SETTINGS);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let isMounted = true;

    browser.storage.local
      .get(GUTCHAIN_SETTINGS_STORAGE_KEY)
      .then((storage) => {
        if (!isMounted) return;
        const savedSettings = storage[GUTCHAIN_SETTINGS_STORAGE_KEY] as
          | GutchainSettings
          | undefined;
        setSettings(normalizeGutchainSettings(savedSettings));
      })
      .catch((error) => {
        if (!isMounted) return;
        setSaveState("error");
        setErrorText(error instanceof Error ? error.message : "Unable to load settings.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedPreset = useMemo(
    () =>
      FRAME_PRESETS.find((preset) => preset.id === settings.screenshotFramePreset) ??
      FRAME_PRESETS[0],
    [settings.screenshotFramePreset],
  );

  async function updateSettings(nextSettings: GutchainSettings) {
    setSettings(nextSettings);
    setSaveState("saving");
    setErrorText("");

    try {
      await browser.storage.local.set({
        [GUTCHAIN_SETTINGS_STORAGE_KEY]: nextSettings,
      });
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setErrorText(error instanceof Error ? error.message : "Unable to save settings.");
    }
  }

  function selectPreset(presetId: GutchainFramePresetId) {
    void updateSettings({
      ...settings,
      screenshotFramePreset: presetId,
    });
  }

  function toggleAuthorInBody(checked: boolean) {
    void updateSettings({
      ...settings,
      includeAuthorInBody: checked,
    });
  }

  return (
    <main className="min-h-screen bg-[#f7f7f4] p-7 text-[#121417] max-[820px]:p-[18px]">
      <header className="mx-auto mb-7 flex max-w-[1100px] items-center justify-between gap-6 max-[820px]:mb-[22px] max-[820px]:flex-col max-[820px]:items-start">
        <div className="flex min-w-0 items-center gap-3">
          <img alt="" className="size-[46px] rounded-lg" src="/icon/48.png" />
          <div>
            <p className={EYEBROW_CLASS}>Gutchain</p>
            <h1 className={`${HEADING_CLASS} text-[30px] leading-[1.05]`}>Settings</h1>
          </div>
        </div>
        <a
          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#d7d3c8] bg-[#fffdf8] px-3 text-[13px] font-[780] text-[#3f392e] no-underline transition-colors hover:border-[#b8ad94] hover:bg-[#fff7e8]"
          href="https://gutchain.fun"
          rel="noreferrer"
          target="_blank"
        >
          gutchain.fun
        </a>
      </header>

      <div className="mx-auto grid max-w-[1100px] grid-cols-[minmax(420px,1fr)_360px] gap-6 max-[820px]:grid-cols-1">
        <section className="min-w-0" aria-label="Selected screenshot frame">
          <div className="mb-3.5 flex min-h-11 items-start justify-between gap-4">
            <div>
              <p className={EYEBROW_CLASS}>Preview</p>
              <h2 className={`${HEADING_CLASS} text-xl leading-[1.1]`}>{selectedPreset.name}</h2>
            </div>
            <SaveBadge errorText={errorText} saveState={saveState} />
          </div>
          <FramePreview preset={selectedPreset} />
        </section>

        <section className="min-w-0" aria-label="Gutchain settings">
          <div className="mb-3.5 flex min-h-11 items-start justify-between gap-4">
            <div>
              <p className={EYEBROW_CLASS}>Frame</p>
              <h2 className={`${HEADING_CLASS} text-xl leading-[1.1]`}>Presets</h2>
            </div>
          </div>

          <fieldset className="m-0 grid gap-3 border-0 p-0">
            <legend className="sr-only">Screenshot frame preset</legend>
            {FRAME_PRESETS.map((preset) => {
              const isSelected = preset.id === settings.screenshotFramePreset;

              return (
                <label
                  className={`preset-card ${isSelected ? "is-selected" : ""}`}
                  key={preset.id}
                  style={{ "--frame-accent": preset.accent } as CSSProperties}
                >
                  <input
                    checked={isSelected}
                    className="preset-radio"
                    name="screenshotFramePreset"
                    onChange={() => selectPreset(preset.id)}
                    type="radio"
                  />
                  <FramePreview compact preset={preset} />
                  <span className="preset-copy">
                    <strong>{preset.name}</strong>
                    <span>{preset.description}</span>
                  </span>
                  <span className="choice-dot" />
                </label>
              );
            })}
          </fieldset>

          <label className="mt-[18px] flex min-h-11 items-center gap-2.5 rounded-lg border border-[#dedbd2] bg-[#fffdf8] px-3 text-sm font-[720] text-[#34342f]">
            <input
              checked={settings.includeAuthorInBody}
              className="m-0 size-4 accent-[#e42d48]"
              onChange={(event) => toggleAuthorInBody(event.currentTarget.checked)}
              type="checkbox"
            />
            <span>Add author to XHS body</span>
          </label>

          <section className="social-panel" aria-label="Gutchain social links">
            <div>
              <p className={EYEBROW_CLASS}>Community</p>
              <h2 className={`${HEADING_CLASS} text-lg leading-[1.1]`}>Follow Gutchain</h2>
            </div>
            <div className="social-grid">
              {SOCIAL_LINKS.map((link) => (
                <a
                  className="social-link"
                  href={link.href}
                  key={link.name}
                  rel="noopener noreferrer"
                  style={{ "--social-accent": link.accent } as CSSProperties}
                  target="_blank"
                >
                  <span className="social-mark" aria-hidden="true">
                    {getSocialMark(link.name)}
                  </span>
                  <span>
                    <strong>{link.name}</strong>
                    <small>{link.description}</small>
                  </span>
                </a>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function getSocialMark(name: string): string {
  if (name === "小红书") return "小";
  if (name === "哔哩哔哩") return "B";
  return name.slice(0, 1);
}

function SaveBadge({ errorText, saveState }: { errorText: string; saveState: SaveState }) {
  const textByState: Record<SaveState, string> = {
    idle: "Ready",
    saving: "Saving",
    saved: "Saved",
    error: errorText || "Error",
  };

  return (
    <span
      className={`${SAVE_BADGE_CLASS} ${SAVE_BADGE_CLASS_BY_STATE[saveState]}`}
      aria-live="polite"
    >
      {textByState[saveState]}
    </span>
  );
}

function FramePreview({ compact = false, preset }: { compact?: boolean; preset: FramePreset }) {
  const style = {
    "--frame-accent": preset.accent,
  } as CSSProperties;

  return (
    <div
      className={`frame-preview ${preset.className} ${compact ? "is-compact" : ""}`}
      style={style}
    >
      <div className="frame-canvas">
        <article className="sample-post">
          <header className="sample-post-header">
            <img alt="" className="sample-avatar" src="/icon/48.png" />
            <div>
              <strong>Gutchain</strong>
              <span>@gutchain</span>
            </div>
          </header>
          <p>
            Overseas ideas, one click into a share-ready draft. The useful part is keeping the
            screenshot clean.
          </p>
          <footer>
            <span>Now</span>
            <span>1.2K views</span>
          </footer>
        </article>
        <div className="frame-footer">
          <span>Gutchain</span>
          <strong>gutchain.fun</strong>
        </div>
      </div>
    </div>
  );
}
