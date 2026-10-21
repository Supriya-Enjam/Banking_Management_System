import { useCallback, useEffect, useState } from "react";
import {
  api,
  type BankAccount,
  type DebitCard,
} from "../services/api";
import "./CardsView.css";

interface CardsViewProps {
  token: string;
  accounts: BankAccount[];
  onRefreshData?: () => void | Promise<void>;
  onToast?: (message: string, type?: "success" | "error") => void;
}

type CardAction = "block" | "cancel";

function formatMoney(amountPaise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountPaise / 100);
}

function formatDate(date?: string | null): string {
  if (!date) return "Not yet activated";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatExpiry(card: DebitCard): string {
  return `${String(card.expiryMonth).padStart(2, "0")}/${card.expiryYear}`;
}

function getStatusLabel(status: DebitCard["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function CardsView({
  token,
  accounts,
  onRefreshData,
  onToast,
}: CardsViewProps) {
  const [cards, setCards] = useState<DebitCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestAccountId, setRequestAccountId] = useState("");
  const [requestPin, setRequestPin] = useState("");

  const [activatingCard, setActivatingCard] = useState<DebitCard | null>(null);
  const [activationNumber, setActivationNumber] = useState("");
  const [activationPin, setActivationPin] = useState("");

  const [confirmAction, setConfirmAction] = useState<{
    card: DebitCard;
    action: CardAction;
  } | null>(null);

  // The backend returns this full number only in the card-request response.
  const [issuedCardNumber, setIssuedCardNumber] = useState("");

  const notify = useCallback(
    (message: string, type: "success" | "error") => {
      if (onToast) {
        onToast(message, type);
      } else if (type === "error") {
        setError(message);
      } else {
        setSuccessMessage(message);
      }
    },
    [onToast]
  );

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.getDebitCards(token);
      setCards(response.cards ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load debit cards."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const activeAccounts = accounts.filter(
    (account) => account.status === "active"
  );

  const activeCards = cards.filter((card) => card.status === "active").length;
  const pendingCards = cards.filter((card) => card.status === "pending").length;
  const blockedCards = cards.filter((card) => card.status === "blocked").length;

  const accountLabel = (accountId: string) => {
    const account = accounts.find((item) => item.id === accountId);

    if (!account) return "Linked bank account";

    return `${account.accountType.toUpperCase()} •••• ${account.accountNumber.slice(-4)}`;
  };

  const handleRequestCard = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!requestAccountId) {
      setError("Please select an active bank account.");
      return;
    }

    if (!/^\d{4}$/.test(requestPin)) {
      setError("Your card PIN must contain exactly 4 digits.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.requestDebitCard(
        token,
        requestAccountId,
        requestPin
      );

      /*
       * Backend response format:
       * {
       *   success: true,
       *   message: "...",
       *   card: {
       *     demoCardNumber: "1234567890123456",
       *     ...
       *   }
       * }
       *
       * Keep the full number in the one-time dialog only.
       */
      const responseData = response as typeof response & {
        card?: {
          demoCardNumber?: string;
        };
        demoCardNumber?: string;
        cardNumber?: string;
      };

      const demoCardNumber =
        typeof responseData.card?.demoCardNumber === "string"
          ? responseData.card.demoCardNumber
          : typeof responseData.demoCardNumber === "string"
            ? responseData.demoCardNumber
            : typeof responseData.cardNumber === "string"
              ? responseData.cardNumber
              : "";

      setIssuedCardNumber(demoCardNumber);

      setShowRequestForm(false);
      setRequestPin("");
      setRequestAccountId("");

      const message =
        response.message ?? "Your debit-card request was submitted.";

      notify(message, "success");

      await loadCards();
      await onRefreshData?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to request a debit card."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivateCard = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!activatingCard) return;

    const normalizedCardNumber = activationNumber.replace(/\s/g, "");

    if (!/^\d{16}$/.test(normalizedCardNumber)) {
      setError(
        "Enter the 16-digit card number provided when the card was issued."
      );
      return;
    }

    if (!/^\d{4}$/.test(activationPin)) {
      setError("Enter a valid 4-digit PIN.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await api.activateDebitCard(
        token,
        activatingCard.id,
        normalizedCardNumber,
        activationPin
      );

      setActivatingCard(null);
      setActivationNumber("");
      setActivationPin("");

      notify(
        response.message ?? "Debit card activated successfully.",
        "success"
      );

      await loadCards();
      await onRefreshData?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to activate card."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmedAction = async () => {
    if (!confirmAction) return;

    const { card, action } = confirmAction;
    setSubmitting(true);
    setError("");

    try {
      const response =
        action === "block"
          ? await api.blockDebitCard(token, card.id)
          : await api.cancelDebitCard(token, card.id);

      setConfirmAction(null);

      notify(
        response.message ??
          (action === "block"
            ? "Debit card blocked successfully."
            : "Debit-card request cancelled."),
        "success"
      );

      await loadCards();
      await onRefreshData?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to ${action} the debit card.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const closeIssuedCardDialog = () => {
    setIssuedCardNumber("");
  };

  return (
    <main className="vb-cards">
      <header className="vb-cards-header">
        <div>
          <span className="vb-eyebrow">BANKING SERVICES</span>
          <h1>Debit Cards</h1>
          <p>Manage your cards, security and ATM access in one place.</p>
        </div>

        <button
          className="vb-primary-button"
          type="button"
          onClick={() => {
            setError("");
            setSuccessMessage("");
            setShowRequestForm(true);
          }}
          disabled={activeAccounts.length === 0 || submitting}
        >
          <span aria-hidden="true">＋</span> Request a card
        </button>
      </header>

      {error && (
        <div className="vb-alert vb-alert-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="vb-alert vb-alert-success" role="status">
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage("")}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <section className="vb-card-stats" aria-label="Debit card summary">
        <article className="vb-stat-card">
          <span className="vb-stat-icon vb-stat-purple">▣</span>
          <div>
            <span className="vb-stat-label">Total cards</span>
            <strong>{cards.length}</strong>
          </div>
        </article>

        <article className="vb-stat-card">
          <span className="vb-stat-icon vb-stat-green">✓</span>
          <div>
            <span className="vb-stat-label">Active cards</span>
            <strong>{activeCards}</strong>
          </div>
        </article>

        <article className="vb-stat-card">
          <span className="vb-stat-icon vb-stat-orange">◷</span>
          <div>
            <span className="vb-stat-label">Pending cards</span>
            <strong>{pendingCards}</strong>
          </div>
        </article>

        <article className="vb-stat-card">
          <span className="vb-stat-icon vb-stat-red">⊘</span>
          <div>
            <span className="vb-stat-label">Blocked cards</span>
            <strong>{blockedCards}</strong>
          </div>
        </article>
      </section>

      <section className="vb-cards-section">
        <div className="vb-section-heading">
          <div>
            <h2>Your cards</h2>
            <p>Only the last four digits of each card are displayed.</p>
          </div>

          <button
            className="vb-outline-button"
            type="button"
            onClick={() => void loadCards()}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="vb-cards-state">
            <span className="vb-spinner" />
            <p>Loading your debit cards…</p>
          </div>
        ) : cards.length === 0 ? (
          <div className="vb-empty-state">
            <div className="vb-empty-icon">▣</div>
            <h3>No debit cards yet</h3>
            <p>
              Request a debit card linked to one of your active bank accounts.
            </p>
            <button
              type="button"
              className="vb-primary-button"
              onClick={() => setShowRequestForm(true)}
              disabled={activeAccounts.length === 0}
            >
              Request your first card
            </button>

            {activeAccounts.length === 0 && (
              <p className="vb-help-text">
                You need an active bank account before requesting a card.
              </p>
            )}
          </div>
        ) : (
          <div className="vb-cards-grid">
            {cards.map((card) => (
              <article className="vb-debit-card-item" key={card.id}>
                <div
                  className={`vb-card-art vb-card-art-${card.status}`}
                  aria-label={`Debit card ending in ${card.cardNumberMasked.slice(-4)}`}
                >
                  <div className="vb-card-art-top">
                    <span className="vb-card-brand">
                      VAULT<span>BANK</span>
                    </span>
                    <span className="vb-card-chip" aria-hidden="true">
                      ▦
                    </span>
                  </div>

                  <div className="vb-card-number">
                    {card.cardNumberMasked}
                  </div>

                  <div className="vb-card-art-bottom">
                    <div>
                      <span className="vb-card-mini-label">VALID THRU</span>
                      <strong>{formatExpiry(card)}</strong>
                    </div>
                    <span className="vb-card-network">DEBIT</span>
                  </div>
                </div>

                <div className="vb-card-details">
                  <div className="vb-card-title-row">
                    <div>
                      <h3>VaultBank Debit Card</h3>
                      <p>{accountLabel(card.accountId)}</p>
                    </div>

                    <span className={`vb-status vb-status-${card.status}`}>
                      <span className="vb-status-dot" />
                      {getStatusLabel(card.status)}
                    </span>
                  </div>

                  <div className="vb-card-info-grid">
                    <div>
                      <span>Daily ATM limit</span>
                      <strong>{formatMoney(card.atmDailyLimitPaise)}</strong>
                    </div>
                    <div>
                      <span>Expiry date</span>
                      <strong>{formatExpiry(card)}</strong>
                    </div>
                    <div>
                      <span>Issued on</span>
                      <strong>{formatDate(card.createdAt)}</strong>
                    </div>
                    <div>
                      <span>Activated on</span>
                      <strong>
                        {card.activatedAt ? formatDate(card.activatedAt) : "—"}
                      </strong>
                    </div>
                  </div>

                  <div className="vb-card-actions">
                    {card.status === "pending" && (
                      <>
                        <button
                          type="button"
                          className="vb-primary-button vb-small-button"
                          onClick={() => {
                            setError("");
                            setActivationNumber("");
                            setActivationPin("");
                            setActivatingCard(card);
                          }}
                          disabled={submitting}
                        >
                          Activate card
                        </button>

                        <button
                          type="button"
                          className="vb-text-button"
                          onClick={() =>
                            setConfirmAction({ card, action: "cancel" })
                          }
                          disabled={submitting}
                        >
                          Cancel request
                        </button>
                      </>
                    )}

                    {card.status === "active" && (
                      <button
                        type="button"
                        className="vb-danger-button"
                        onClick={() =>
                          setConfirmAction({ card, action: "block" })
                        }
                        disabled={submitting}
                      >
                        Block card
                      </button>
                    )}

                    {card.status === "blocked" && (
                      <p className="vb-blocked-note">
                        This card is blocked. Contact bank support if you need
                        assistance.
                      </p>
                    )}

                    {card.status === "expired" && (
                      <p className="vb-blocked-note">
                        This card has expired. Request a replacement if available.
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="vb-security-note">
        <span className="vb-security-icon">♢</span>
        <div>
          <h3>Keep your card secure</h3>
          <p>
            Never share your PIN, OTP or complete card details. If you suspect
            unauthorized activity, block your active card and contact your bank.
          </p>
        </div>
      </aside>

      {showRequestForm && (
        <div
          className="vb-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setShowRequestForm(false);
            }
          }}
        >
          <section
            className="vb-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vb-request-title"
          >
            <div className="vb-modal-heading">
              <div>
                <span className="vb-eyebrow">NEW CARD</span>
                <h2 id="vb-request-title">Request a debit card</h2>
              </div>

              <button
                type="button"
                className="vb-modal-close"
                onClick={() => setShowRequestForm(false)}
                disabled={submitting}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {activeAccounts.length === 0 ? (
              <div className="vb-empty-inline">
                You need an active bank account before requesting a debit card.
              </div>
            ) : (
              <form onSubmit={handleRequestCard}>
                <p className="vb-modal-description">
                  Select the account to link to your new card and create a
                  four-digit PIN.
                </p>

                <label className="vb-field">
                  <span>Bank account</span>
                  <select
                    value={requestAccountId}
                    onChange={(event) =>
                      setRequestAccountId(event.target.value)
                    }
                    required
                  >
                    <option value="">Select an active account</option>
                    {activeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.accountType.toUpperCase()} ••••{" "}
                        {account.accountNumber.slice(-4)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="vb-field">
                  <span>Create 4-digit card PIN</span>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    maxLength={4}
                    pattern="[0-9]{4}"
                    value={requestPin}
                    onChange={(event) =>
                      setRequestPin(
                        event.target.value.replace(/\D/g, "").slice(0, 4)
                      )
                    }
                    placeholder="Enter 4 digits"
                    required
                  />
                  <small>
                    Do not reuse your banking password or share this PIN.
                  </small>
                </label>

                <div className="vb-modal-actions">
                  <button
                    type="button"
                    className="vb-outline-button"
                    onClick={() => setShowRequestForm(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="vb-primary-button"
                    disabled={submitting}
                  >
                    {submitting ? "Submitting…" : "Request card"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {activatingCard && (
        <div className="vb-modal-backdrop">
          <section
            className="vb-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vb-activate-title"
          >
            <div className="vb-modal-heading">
              <div>
                <span className="vb-eyebrow">CARD SECURITY</span>
                <h2 id="vb-activate-title">Activate your card</h2>
              </div>

              <button
                type="button"
                className="vb-modal-close"
                onClick={() => {
                  setActivatingCard(null);
                  setActivationNumber("");
                  setActivationPin("");
                  setError("");
                }}
                disabled={submitting}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleActivateCard}>
              <p className="vb-modal-description">
                Enter the 16-digit demo card number provided when the card was
                requested, along with the PIN you created for that card.
              </p>

              <label className="vb-field">
                <span>16-digit card number</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={19}
                  value={activationNumber}
                  onChange={(event) =>
                    setActivationNumber(
                      event.target.value.replace(/[^\d\s]/g, "").slice(0, 19)
                    )
                  }
                  placeholder="1234 5678 9012 3456"
                  required
                />
              </label>

              <label className="vb-field">
                <span>4-digit card PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  value={activationPin}
                  onChange={(event) =>
                    setActivationPin(
                      event.target.value.replace(/\D/g, "").slice(0, 4)
                    )
                  }
                  placeholder="Enter card PIN"
                  required
                />
              </label>

              <div className="vb-modal-actions">
                <button
                  type="button"
                  className="vb-outline-button"
                  onClick={() => {
                    setActivatingCard(null);
                    setActivationNumber("");
                    setActivationPin("");
                    setError("");
                  }}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="vb-primary-button"
                  disabled={submitting}
                >
                  {submitting ? "Activating…" : "Activate card"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {confirmAction && (
        <div className="vb-modal-backdrop">
          <section
            className="vb-modal vb-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vb-confirm-title"
          >
            <div className="vb-confirm-icon">
              {confirmAction.action === "block" ? "!" : "×"}
            </div>

            <h2 id="vb-confirm-title">
              {confirmAction.action === "block"
                ? "Block this card?"
                : "Cancel card request?"}
            </h2>

            <p>
              {confirmAction.action === "block"
                ? "Blocking this card may prevent further card use. You may need bank support to restore access."
                : "This will cancel the pending debit-card request."}
            </p>

            <div className="vb-modal-actions">
              <button
                type="button"
                className="vb-outline-button"
                onClick={() => setConfirmAction(null)}
                disabled={submitting}
              >
                Keep card
              </button>

              <button
                type="button"
                className="vb-danger-button"
                onClick={() => void handleConfirmedAction()}
                disabled={submitting}
              >
                {submitting
                  ? "Please wait…"
                  : confirmAction.action === "block"
                    ? "Confirm block"
                    : "Confirm cancellation"}
              </button>
            </div>
          </section>
        </div>
      )}

      {issuedCardNumber && (
        <div className="vb-modal-backdrop">
          <section
            className="vb-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vb-issued-title"
          >
            <div className="vb-issued-success">✓</div>
            <h2 id="vb-issued-title">Card request submitted</h2>

            <p className="vb-modal-description">
              Your demo card number was returned by the server. Save it now;
              this screen will not be able to recover it after you close it.
            </p>

            <div className="vb-issued-number">
              <span>Demo card number</span>
              <strong>{issuedCardNumber}</strong>
            </div>

            <button
              type="button"
              className="vb-primary-button vb-full-button"
              onClick={closeIssuedCardDialog}
            >
              I have saved my card number
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
