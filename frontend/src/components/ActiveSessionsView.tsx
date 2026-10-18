
import { useCallback, useEffect, useState } from "react";
import { api, type ActiveSession } from "../services/api";
import "./ActiveSessionsView.css";

interface ActiveSessionsViewProps {
  token: string;
  onToast: (message: string) => void;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Unavailable";

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getDeviceName(userAgent: string): string {
  if (/android/i.test(userAgent)) return "Android device";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "Apple mobile device";
  if (/windows/i.test(userAgent)) return "Windows device";
  if (/macintosh|mac os/i.test(userAgent)) return "Mac device";
  if (/linux/i.test(userAgent)) return "Linux device";
  if (!userAgent || userAgent === "Unknown") return "Unknown device";

  return "Other device";
}

export function ActiveSessionsView({
  token,
  onToast,
}: ActiveSessionsViewProps) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await api.getActiveSessions(token);
      setSessions(response.sessions ?? []);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load active sessions.";

      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleRevoke = async (session: ActiveSession) => {
    if (session.isCurrent) {
      onToast(
        "This is your current session. Use Sign Out to end it."
      );
      return;
    }

    const confirmed = window.confirm(
      "Sign out this device? It will no longer be able to access VaultBank."
    );

    if (!confirmed) return;

    setRevokingId(session.sessionId);

    try {
      await api.revokeSession(token, session.sessionId);

      setSessions((current) =>
        current.filter(
          (item) => item.sessionId !== session.sessionId
        )
      );

      onToast("The selected session was revoked successfully.");
    } catch (error: unknown) {
      onToast(
        error instanceof Error
          ? error.message
          : "Unable to revoke this session."
      );
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section className="sessions-page">
      <div className="sessions-heading">
        <div>
          <span className="sessions-eyebrow">ACCOUNT SECURITY</span>
          <h1>Active sessions</h1>
          <p>
            Review the devices signed in to your VaultBank account.
            Sign out devices you no longer use or do not recognize.
          </p>
        </div>

        <button
          className="sessions-refresh"
          type="button"
          onClick={() => void loadSessions()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      <div className="sessions-security-note">
        <span className="sessions-shield" aria-hidden="true">
          ✓
        </span>
        <div>
          <strong>Keep your account secure</strong>
          <p>
            Never share your password or verification codes. If you
            notice an unfamiliar device, revoke its session and
            change your password.
          </p>
        </div>
      </div>

      <div className="sessions-summary">
        <div>
          <span>Active sessions</span>
          <strong>{sessions.length}</strong>
        </div>
        <div>
          <span>Current device</span>
          <strong>
            {sessions.some((session) => session.isCurrent)
              ? "This device"
              : "Not identified"}
          </strong>
        </div>
      </div>

      <div className="sessions-list-heading">
        <div>
          <h2>Your devices</h2>
          <p>Session activity and expiry information</p>
        </div>
      </div>

      {loading && sessions.length === 0 ? (
        <div className="sessions-state" role="status">
          <span className="sessions-spinner" />
          <p>Loading your active sessions…</p>
        </div>
      ) : loadError ? (
        <div className="sessions-state sessions-error" role="alert">
          <h3>Sessions could not be loaded</h3>
          <p>{loadError}</p>
          <button type="button" onClick={() => void loadSessions()}>
            Try again
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="sessions-state">
          <div className="sessions-empty-icon" aria-hidden="true">
            ◉
          </div>
          <h3>No active sessions found</h3>
          <p>
            Refresh this page or sign in again if you believe this is
            incorrect.
          </p>
        </div>
      ) : (
        <div className="sessions-list">
          {sessions.map((session) => (
            <article
              className="session-card"
              key={session.sessionId}
            >
              <div className="session-device-icon" aria-hidden="true">
                {getDeviceName(session.userAgent).includes("mobile")
                  ? "▯"
                  : "▣"}
              </div>

              <div className="session-details">
                <div className="session-title-row">
                  <h3>{getDeviceName(session.userAgent)}</h3>

                  {session.isCurrent && (
                    <span className="session-current-badge">
                      Current session
                    </span>
                  )}
                </div>

                <p className="session-browser">
                  {session.userAgent &&
                  session.userAgent !== "Unknown"
                    ? session.userAgent
                    : "Device/browser details unavailable"}
                </p>

                <div className="session-metadata">
                  <span>
                    <strong>IP address:</strong>{" "}
                    {session.ipAddress || "Unknown"}
                  </span>
                  <span>
                    <strong>Last activity:</strong>{" "}
                    {formatDate(session.lastActivityAt)}
                  </span>
                  <span>
                    <strong>Expires:</strong>{" "}
                    {formatDate(session.expiresAt)}
                  </span>
                </div>
              </div>

              {session.isCurrent ? (
                <span className="session-current-label">
                  In use now
                </span>
              ) : (
                <button
                  className="session-revoke-button"
                  type="button"
                  disabled={revokingId === session.sessionId}
                  onClick={() => void handleRevoke(session)}
                >
                  {revokingId === session.sessionId
                    ? "Signing out…"
                    : "Revoke session"}
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      <p className="sessions-footnote">
        Session activity updates when you make authenticated requests.
        Device and IP details depend on the information received by
        the server.
      </p>
    </section>
  );
}

export default ActiveSessionsView;
