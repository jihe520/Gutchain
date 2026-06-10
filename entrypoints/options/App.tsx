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
    <main className="options-shell">
      <header className="topbar">
        <div className="brand">
          <img alt="" className="brand-mark" src="/icon/48.png" />
          <div>
            <p className="eyebrow">Gutchain</p>
            <h1>Settings</h1>
          </div>
        </div>
        <a className="official-link" href="https://gutchain.fun" rel="noreferrer" target="_blank">
          gutchain.fun
        </a>
      </header>

      <div className="settings-layout">
        <section className="preview-workbench" aria-label="Selected screenshot frame">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Preview</p>
              <h2>{selectedPreset.name}</h2>
            </div>
            <SaveBadge errorText={errorText} saveState={saveState} />
          </div>
          <FramePreview preset={selectedPreset} />
        </section>

        <section className="controls" aria-label="Gutchain settings">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Frame</p>
              <h2>Presets</h2>
            </div>
          </div>

          <fieldset className="preset-grid">
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

          <label className="option-row">
            <input
              checked={settings.includeAuthorInBody}
              onChange={(event) => toggleAuthorInBody(event.currentTarget.checked)}
              type="checkbox"
            />
            <span>Add author to XHS body</span>
          </label>
        </section>
      </div>
    </main>
  );
}

function SaveBadge({ errorText, saveState }: { errorText: string; saveState: SaveState }) {
  const textByState: Record<SaveState, string> = {
    idle: "Ready",
    saving: "Saving",
    saved: "Saved",
    error: errorText || "Error",
  };

  return (
    <span className={`save-badge save-badge-${saveState}`} aria-live="polite">
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
