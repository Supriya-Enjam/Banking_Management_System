
import React, { useEffect, useRef, useState } from "react";
import { ShieldAlert, Clock, X } from "lucide-react";

interface SessionExpiryCardProps {
  open: boolean;
  onStayLoggedIn: () => void;
  onLogout: () => void;
  onClose?: () => void;
}

export const SessionExpiryCard: React.FC<SessionExpiryCardProps> = ({
  open,
  onStayLoggedIn,
  onLogout,
  onClose,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(120);

  // Keep the latest callback without restarting the countdown.
  const onLogoutRef = useRef(onLogout);

  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  // Run the countdown only when the card opens or closes.
  useEffect(() => {
    if (!open) {
      setSecondsLeft(120);
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [open]);

  // Log out when the countdown reaches zero.
  useEffect(() => {
    if (open && secondsLeft === 0) {
      onLogoutRef.current();
    }
  }, [open, secondsLeft]);

  if (!open) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  const handleStayLoggedIn = () => {
    // The parent closes the card only after the server confirms
    // that the session is still active.
    onStayLoggedIn();
  };

  return (
    <div className="session-expiry-overlay">
      <div
        className="session-expiry-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-expiry-title"
        aria-describedby="session-expiry-description"
      >
        <div className="session-expiry-header">
          <div className="session-expiry-icon">
            <ShieldAlert size={24} />
          </div>

          <div className="session-expiry-heading">
            <h3 id="session-expiry-title">
              Session expiring soon
            </h3>
            <p>Are you still using VaultBank?</p>
          </div>

          {onClose && (
            <button
              type="button"
              className="session-expiry-close"
              onClick={onClose}
              aria-label="Close warning"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="session-expiry-message">
          <Clock size={18} />
          <span>You will be logged out in</span>
        </div>

        <div className="session-expiry-countdown" aria-live="off">
          {String(minutes).padStart(2, "0")}:
          {String(seconds).padStart(2, "0")}
        </div>

        <p
          id="session-expiry-description"
          className="session-expiry-note"
        >
          Stay logged in to continue your banking securely.
        </p>

        <button
          type="button"
          className="session-expiry-stay"
          onClick={handleStayLoggedIn}
        >
          Stay logged in
        </button>

        <button
          type="button"
          className="session-expiry-logout"
          onClick={onLogout}
        >
          Log out
        </button>
      </div>
    </div>
  );
};
