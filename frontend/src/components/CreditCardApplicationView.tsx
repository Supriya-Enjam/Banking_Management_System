
import React, { useState } from "react";
import { api } from "../services/api";
import "./CreditCardApplicationView.css";

interface CreditCardApplicationViewProps {
  token: string;
  onToast: (message: string) => void;
  onApplicationSubmitted?: () => void;
}

const formatRupees = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const CreditCardApplicationView: React.FC<
  CreditCardApplicationViewProps
> = ({ token, onToast, onApplicationSubmitted }) => {
  const [limit, setLimit] = useState("50000");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const requestedLimit = Number(limit);

  const isValidLimit =
    Number.isSafeInteger(requestedLimit) &&
    requestedLimit >= 5000 &&
    requestedLimit <= 500000;

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");

    if (!isValidLimit) {
      setError("Choose a whole-rupee limit between ₹5,000 and ₹5,00,000.");
      return;
    }

    if (!agreed) {
      setError("Please confirm that you understand the application terms.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.applyForCreditCard(
        token,
        requestedLimit
      );

      setSubmitted(true);
      onToast(response.message || "Application submitted successfully.");
      onApplicationSubmitted?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to submit your application.";

      setError(message);
      onToast(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="cc-application-page">
        <div className="cc-application-success">
          <div className="cc-application-success-icon">✓</div>
          <p className="cc-application-eyebrow">VAULTBANK</p>
          <h1>Application submitted!</h1>
          <p>
            Your credit card application has been received and is
            awaiting review by our bank team.
          </p>

          <div className="cc-application-status">
            <span>Requested credit limit</span>
            <strong>{formatRupees(requestedLimit)}</strong>
            <span>Application status</span>
            <strong className="cc-pending">Pending review</strong>
          </div>

          <p className="cc-application-note">
            Your card is not active yet. You can use it after the
            bank approves your application.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="cc-application-page">
      <header className="cc-application-heading">
        <p className="cc-application-eyebrow">
          VAULTBANK · PERSONAL BANKING
        </p>
        <h1>Apply for a Credit Card</h1>
        <p>
          Choose your requested credit limit and submit your
          application for bank review.
        </p>
      </header>

      <div className="cc-application-layout">
        <aside className="cc-application-preview">
          <div className="cc-preview-top">
            <span>VAULTBANK</span>
            <span>▦</span>
          </div>

          <p className="cc-preview-label">CREDIT CARD</p>
          <div className="cc-preview-number">
            XXXX XXXX XXXX XXXX
          </div>

          <div className="cc-preview-bottom">
            <span>YOUR REQUESTED LIMIT</span>
            <strong>
              {isValidLimit ? formatRupees(requestedLimit) : "—"}
            </strong>
          </div>

          <p className="cc-preview-note">
            Illustrative preview — this is not an issued card.
          </p>
        </aside>

        <form
          className="cc-application-form"
          onSubmit={handleSubmit}
        >
          <h2>Application details</h2>
          <p className="cc-form-description">
            Enter the credit limit you would like the bank to review.
          </p>

          <label htmlFor="requestedLimit">
            Requested credit limit (₹)
          </label>

          <select
            id="requestedLimit"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            disabled={submitting}
          >
            <option value="5000">₹5,000</option>
            <option value="10000">₹10,000</option>
            <option value="25000">₹25,000</option>
            <option value="50000">₹50,000</option>
            <option value="75000">₹75,000</option>
            <option value="100000">₹1,00,000</option>
            <option value="200000">₹2,00,000</option>
            <option value="300000">₹3,00,000</option>
            <option value="500000">₹5,00,000</option>
          </select>

          <div className="cc-limit-info">
            <span>Minimum limit</span>
            <strong>₹5,000</strong>
            <span>Maximum limit</span>
            <strong>₹5,00,000</strong>
          </div>

          <label className="cc-agreement">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              disabled={submitting}
            />
            <span>
              I confirm that my application details are accurate
              and understand that this application requires bank
              review and approval.
            </span>
          </label>

          {error && (
            <div className="cc-application-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="cc-application-submit"
            disabled={submitting || !isValidLimit}
          >
            {submitting
              ? "Submitting application..."
              : "Submit application"}
          </button>

          <p className="cc-security-note">
            <span>🔒</span> Your application is associated with your
            authenticated VaultBank account.
          </p>
        </form>
      </div>
    </section>
  );
};

export default CreditCardApplicationView;
