
import { useEffect, useState } from "react";
import { Cookie, Settings, X } from "lucide-react";
import "./CookieConsent.css";

type CookiePreferences = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

type ConsentRecord = {
  preferences: CookiePreferences;
  savedAt: string;
};

const CONSENT_KEY = "vaultbank_cookie_consent_v1";

const defaultPreferences: CookiePreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
};

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferences, setPreferences] =
    useState<CookiePreferences>(defaultPreferences);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONSENT_KEY);

      if (!saved) {
        setVisible(true);
        return;
      }

      const record = JSON.parse(saved) as ConsentRecord;

      if (
        record.preferences &&
        typeof record.preferences.analytics === "boolean" &&
        typeof record.preferences.marketing === "boolean"
      ) {
        setPreferences({
          necessary: true,
          analytics: record.preferences.analytics,
          marketing: record.preferences.marketing,
        });
      } else {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  function savePreferences(next: CookiePreferences) {
    const record: ConsentRecord = {
      preferences: next,
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
      setPreferences(next);
      setVisible(false);
      setSettingsOpen(false);
    } catch {
      // Do not pretend consent was saved if browser storage is unavailable.
      setPreferences(next);
      setSettingsOpen(false);
    }
  }

  function acceptAll() {
    savePreferences({
      necessary: true,
      analytics: true,
      marketing: true,
    });
  }

  function rejectOptional() {
    savePreferences({
      necessary: true,
      analytics: false,
      marketing: false,
    });
  }

  if (!visible) {
    return null;
  }

  return (
    <>
      <section
        className="vb-cookie-banner"
        role="region"
        aria-label="Cookie preferences"
      >
        <div className="vb-cookie-icon" aria-hidden="true">
          <Cookie size={23} />
        </div>

        <div className="vb-cookie-copy">
          <h2>We value your privacy</h2>
          <p>
            VaultBank uses necessary storage to support essential website
            functions. With your permission, we may also use optional
            analytics and marketing cookies. You can change your choice
            at any time.
          </p>
          <button
            className="vb-cookie-text-button"
            type="button"
            onClick={() => setSettingsOpen(true)}
          >
            Learn about cookie preferences
          </button>
        </div>

        <div className="vb-cookie-actions">
          <button
            className="vb-cookie-button vb-cookie-settings"
            type="button"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={16} />
            Settings
          </button>

          <button
            className="vb-cookie-button vb-cookie-reject"
            type="button"
            onClick={rejectOptional}
          >
            Reject optional
          </button>

          <button
            className="vb-cookie-button vb-cookie-accept"
            type="button"
            onClick={acceptAll}
          >
            Accept all
          </button>
        </div>

        <button
          className="vb-cookie-close"
          type="button"
          aria-label="Open cookie settings"
          onClick={() => setSettingsOpen(true)}
        >
          <X size={18} />
        </button>
      </section>

      {settingsOpen && (
        <div
          className="vb-cookie-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSettingsOpen(false);
            }
          }}
        >
          <section
            className="vb-cookie-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vb-cookie-dialog-title"
          >
            <div className="vb-cookie-dialog-heading">
              <div>
                <span className="vb-cookie-eyebrow">VAULTBANK PRIVACY</span>
                <h2 id="vb-cookie-dialog-title">Cookie preferences</h2>
              </div>

              <button
                type="button"
                className="vb-cookie-dialog-close"
                aria-label="Close cookie settings"
                onClick={() => setSettingsOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <p className="vb-cookie-dialog-description">
              Choose which optional categories you allow. Necessary
              functionality remains enabled.
            </p>

            <div className="vb-cookie-category">
              <div>
                <h3>Necessary</h3>
                <p>Required for essential website and security functions.</p>
              </div>
              <span className="vb-cookie-always-on">Always on</span>
            </div>

            <div className="vb-cookie-category">
              <div>
                <h3>Analytics</h3>
                <p>Helps measure website usage and improve the experience.</p>
              </div>
              <label className="vb-cookie-toggle">
                <input
                  type="checkbox"
                  checked={preferences.analytics}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      analytics: event.target.checked,
                    }))
                  }
                  aria-label="Allow analytics cookies"
                />
                <span className="vb-cookie-toggle-track" />
              </label>
            </div>

            <div className="vb-cookie-category">
              <div>
                <h3>Marketing</h3>
                <p>Allows relevant marketing or campaign measurement.</p>
              </div>
              <label className="vb-cookie-toggle">
                <input
                  type="checkbox"
                  checked={preferences.marketing}
                  onChange={(event) =>
                    setPreferences((current) => ({
                      ...current,
                      marketing: event.target.checked,
                    }))
                  }
                  aria-label="Allow marketing cookies"
                />
                <span className="vb-cookie-toggle-track" />
              </label>
            </div>

            <div className="vb-cookie-dialog-actions">
              <button
                type="button"
                className="vb-cookie-button vb-cookie-reject"
                onClick={rejectOptional}
              >
                Reject optional
              </button>

              <button
                type="button"
                className="vb-cookie-button vb-cookie-accept"
                onClick={() => savePreferences(preferences)}
              >
                Save my choices
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
