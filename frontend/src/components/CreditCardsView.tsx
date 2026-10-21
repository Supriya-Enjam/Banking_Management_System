
import React, { useCallback, useEffect, useState } from "react";
import {
  api,
  type BankAccount,
  type CreditCard,
  type CreditCardTransaction,
} from "../services/api";
import "./CreditCardsView.css";

interface CreditCardsViewProps {
  token: string;
  onToast: (message: string) => void;
}

type TransactionFilter = "all" | "purchase" | "repayment";

const formatRupees = (paise: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);

const formatDate = (date: string): string => {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const CreditCardsView: React.FC<CreditCardsViewProps> = ({
  token,
  onToast,
}) => {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [transactions, setTransactions] = useState<
    CreditCardTransaction[]
  >([]);

  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [loadingCards, setLoadingCards] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [processingPurchase, setProcessingPurchase] = useState(false);
  const [processingRepayment, setProcessingRepayment] = useState(false);

  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [purchaseDescription, setPurchaseDescription] = useState("");

  const [repaymentAccountId, setRepaymentAccountId] = useState("");
  const [repaymentAmount, setRepaymentAmount] = useState("");

  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");

  const selectedCard =
    cards.find((card) => card.id === selectedCardId) ?? null;

  const activeAccounts = accounts.filter(
    (account) => account.status === "active"
  );

  const outstandingPaise =
    selectedCard?.outstandingBalancePaise ?? 0;

  const purchaseValue = Number(purchaseAmount);
  const repaymentValue = Number(repaymentAmount);

  const validPurchaseAmount =
    purchaseAmount.trim() !== "" &&
    Number.isFinite(purchaseValue) &&
    purchaseValue > 0 &&
    Math.round(purchaseValue * 100) === purchaseValue * 100 &&
    purchaseValue <= 1_000_000;

  const validRepaymentAmount =
    repaymentAmount.trim() !== "" &&
    Number.isFinite(repaymentValue) &&
    repaymentValue > 0 &&
    Math.round(repaymentValue * 100) === repaymentValue * 100 &&
    repaymentValue <= outstandingPaise / 100;

  const loadCards = useCallback(
    async (showLoading = true) => {
      if (!token) {
        setCards([]);
        setSelectedCardId("");
        setTransactions([]);
        setError("Please log in to view your credit cards.");
        setLoadingCards(false);
        return;
      }

      if (showLoading) setLoadingCards(true);
      setError("");

      try {
        const response = await api.getCreditCards(token);
        const loadedCards = Array.isArray(response.cards)
          ? response.cards
          : [];

        setCards(loadedCards);

        setSelectedCardId((previousId) =>
          loadedCards.some((card) => card.id === previousId)
            ? previousId
            : loadedCards[0]?.id ?? ""
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Unable to load your credit cards.";

        setError(message);
        onToast(message);
      } finally {
        if (showLoading) setLoadingCards(false);
      }
    },
    [token, onToast]
  );

  const loadAccounts = useCallback(async () => {
    if (!token) {
      setAccounts([]);
      setLoadingAccounts(false);
      return;
    }

    setLoadingAccounts(true);

    try {
      const response = await api.getAccounts(token);
      const loadedAccounts = Array.isArray(response.accounts)
        ? response.accounts
        : [];

      setAccounts(loadedAccounts);

      setRepaymentAccountId((previousId) =>
        loadedAccounts.some(
          (account) =>
            account.id === previousId && account.status === "active"
        )
          ? previousId
          : loadedAccounts.find(
              (account) => account.status === "active"
            )?.id ?? ""
      );
    } catch (err: unknown) {
      onToast(
        err instanceof Error
          ? `Unable to load bank accounts: ${err.message}`
          : "Unable to load your bank accounts."
      );
    } finally {
      setLoadingAccounts(false);
    }
  }, [token, onToast]);

  const loadHistory = useCallback(async () => {
    if (!token || !selectedCardId) {
      setTransactions([]);
      setHistoryError("");
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);
    setHistoryError("");

    try {
      const response = await api.getCreditCardTransactions(
        token,
        selectedCardId,
        {
          page: 1,
          limit: 50,
          type: filter,
        }
      );

      setTransactions(
        Array.isArray(response.transactions)
          ? response.transactions
          : []
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to load credit card transactions.";

      setTransactions([]);
      setHistoryError(message);
    } finally {
      setLoadingHistory(false);
    }
  }, [token, selectedCardId, filter]);

  useEffect(() => {
    void loadCards();
    void loadAccounts();
  }, [loadCards, loadAccounts]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const refreshCardData = async () => {
    await loadCards(false);
    await loadHistory();
  };

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await Promise.all([loadCards(false), loadAccounts()]);
      await loadHistory();
    } finally {
      setRefreshing(false);
    }
  };

  const handlePurchase = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!selectedCard || processingPurchase) return;

    if (selectedCard.status !== "active") {
      onToast("Only active credit cards can make purchases.");
      return;
    }

    if (!validPurchaseAmount) {
      onToast("Enter a valid purchase amount up to ₹10,00,000.");
      return;
    }

    if (purchaseValue * 100 > selectedCard.availableCreditPaise) {
      onToast("Purchase amount exceeds your available credit.");
      return;
    }

    setProcessingPurchase(true);

    try {
      const response = await api.purchaseCreditCard(
        token,
        selectedCard.id,
        {
          amount: purchaseValue,
          merchant: merchant.trim() || undefined,
          description: purchaseDescription.trim() || undefined,
        }
      );

      setPurchaseAmount("");
      setMerchant("");
      setPurchaseDescription("");

      onToast(response.message || "Credit card purchase successful.");

      await refreshCardData();
    } catch (err: unknown) {
      onToast(
        err instanceof Error
          ? err.message
          : "Unable to complete the credit card purchase."
      );
    } finally {
      setProcessingPurchase(false);
    }
  };

  const handleRepayment = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!selectedCard || processingRepayment) return;

    if (
      selectedCard.status !== "active" &&
      selectedCard.status !== "blocked"
    ) {
      onToast("This card is not eligible for repayment.");
      return;
    }

    if (!repaymentAccountId) {
      onToast("Please select an active bank account.");
      return;
    }

    if (!validRepaymentAmount) {
      onToast("Enter a valid amount not exceeding the outstanding balance.");
      return;
    }

    setProcessingRepayment(true);

    try {
      const response = await api.repayCreditCard(
        token,
        selectedCard.id,
        {
          accountId: repaymentAccountId,
          amount: repaymentValue,
        }
      );

      setRepaymentAmount("");

      onToast(response.message || "Credit card repayment successful.");

      await Promise.all([loadAccounts(), loadCards(false)]);
      await loadHistory();
    } catch (err: unknown) {
      onToast(
        err instanceof Error
          ? err.message
          : "Unable to complete the credit card repayment."
      );
    } finally {
      setProcessingRepayment(false);
    }
  };

  const handleBlockCard = async () => {
    if (!selectedCard || blocking) return;
    if (selectedCard.status !== "active") return;

    const lastFour = selectedCard.cardNumberMasked.slice(-4);
    const confirmed = window.confirm(
      `Are you sure you want to block the credit card ending in ${lastFour}?`
    );

    if (!confirmed) return;

    setBlocking(true);

    try {
      await api.blockCreditCard(token, selectedCard.id);
      onToast("Credit card blocked successfully.");
      await loadCards(false);
    } catch (err: unknown) {
      onToast(
        err instanceof Error
          ? err.message
          : "Unable to block the credit card."
      );
    } finally {
      setBlocking(false);
    }
  };

  if (loadingCards) {
    return (
      <section className="credit-page">
        <div className="credit-loading">
          <span className="credit-spinner" />
          Loading your credit cards...
        </div>
      </section>
    );
  }

  return (
    <section className="credit-page">
      <div className="credit-page-heading">
        <div>
          <p className="credit-eyebrow">
            VAULTBANK · PERSONAL BANKING
          </p>
          <h1>Credit Cards</h1>
          <p>
            Manage your credit, monitor spending, make purchases, and
            repay your outstanding balance.
          </p>
        </div>

        <button
          type="button"
          className="credit-button credit-button-secondary"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      {error && (
        <div className="credit-error" role="alert">
          <strong>Unable to load credit cards</strong>
          <p>{error}</p>
          <button
            type="button"
            className="credit-button credit-button-primary"
            onClick={() => void loadCards()}
          >
            Try again
          </button>
        </div>
      )}

      {!error && cards.length === 0 ? (
        <div className="credit-empty">
          <div className="credit-empty-icon">▤</div>
          <h2>No credit cards yet</h2>
          <p>
            No credit cards are currently associated with your
            customer account.
          </p>
          <p>
            If you have a pending application, check its status or
            contact your bank for assistance.
          </p>
        </div>
      ) : (
        cards.length > 0 && (
          <>
            <div className="credit-card-grid">
              {cards.map((card) => {
                const isSelected = card.id === selectedCardId;

                return (
                  <button
                    type="button"
                    key={card.id}
                    className={`credit-visual-card ${
                      isSelected ? "credit-visual-card-selected" : ""
                    }`}
                    onClick={() => setSelectedCardId(card.id)}
                    aria-pressed={isSelected}
                  >
                    <div className="credit-visual-top">
                      <span>VAULTBANK</span>
                      <span className="credit-chip">▦</span>
                    </div>

                    <div className="credit-card-label">CREDIT CARD</div>
                    <div className="credit-card-number">
                      {card.cardNumberMasked}
                    </div>

                    <div className="credit-visual-bottom">
                      <div>
                        <span className="credit-small-label">
                          CREDIT LIMIT
                        </span>
                        <strong>
                          {formatRupees(card.creditLimitPaise)}
                        </strong>
                      </div>

                      <div className="credit-visual-expiry">
                        <span className="credit-small-label">EXPIRES</span>
                        <strong>
                          {String(card.expiryMonth).padStart(2, "0")}/
                          {String(card.expiryYear).slice(-2)}
                        </strong>
                      </div>
                    </div>

                    <span
                      className={`credit-status credit-status-${card.status}`}
                    >
                      {card.status}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedCard && (
              <>
                <div className="credit-section-heading">
                  <div>
                    <h2>Card overview</h2>
                    <p>
                      {selectedCard.cardNumberMasked} · Selected card
                    </p>
                  </div>

                  {selectedCard.status === "active" && (
                    <button
                      type="button"
                      className="credit-button credit-button-danger"
                      onClick={() => void handleBlockCard()}
                      disabled={blocking}
                    >
                      {blocking ? "Blocking..." : "Block card"}
                    </button>
                  )}
                </div>

                <div className="credit-summary-grid">
                  <article className="credit-summary-card">
                    <span>Credit limit</span>
                    <strong>
                      {formatRupees(selectedCard.creditLimitPaise)}
                    </strong>
                    <small>Your total approved credit</small>
                  </article>

                  <article className="credit-summary-card credit-summary-outstanding">
                    <span>Outstanding balance</span>
                    <strong>
                      {formatRupees(selectedCard.outstandingBalancePaise)}
                    </strong>
                    <small>Amount currently owed</small>
                  </article>

                  <article className="credit-summary-card credit-summary-available">
                    <span>Available credit</span>
                    <strong>
                      {formatRupees(selectedCard.availableCreditPaise)}
                    </strong>
                    <small>Credit remaining to spend</small>
                  </article>
                </div>

                <div className="credit-details-panel">
                  <h3>Card details</h3>

                  <div className="credit-details-grid">
                    <div>
                      <span>Billing day</span>
                      <strong>{selectedCard.billingDay} of each month</strong>
                    </div>

                    <div>
                      <span>Payment due date</span>
                      <strong>
                        {selectedCard.paymentDueDate
                          ? formatDate(selectedCard.paymentDueDate)
                          : "Not scheduled"}
                      </strong>
                    </div>

                    <div>
                      <span>Card status</span>
                      <strong className="credit-capitalize">
                        {selectedCard.status}
                      </strong>
                    </div>

                    <div>
                      <span>Activated on</span>
                      <strong>
                        {selectedCard.activatedAt
                          ? formatDate(selectedCard.activatedAt)
                          : "Not activated"}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Purchase form */}
                {selectedCard.status === "active" && (
                  <div className="credit-action-panel">
                    <div className="credit-history-heading">
                      <div>
                        <h2>Make a purchase</h2>
                        <p>
                          Available credit:{" "}
                          {formatRupees(selectedCard.availableCreditPaise)}
                        </p>
                      </div>
                    </div>

                    {selectedCard.availableCreditPaise > 0 ? (
                      <form onSubmit={handlePurchase}>
                        <div className="credit-form-grid">
                          <label className="credit-form-field">
                            Purchase amount (₹)
                            <input
                              type="number"
                              min="0.01"
                              max={Math.min(
                                1_000_000,
                                selectedCard.availableCreditPaise / 100
                              )}
                              step="0.01"
                              value={purchaseAmount}
                              onChange={(event) =>
                                setPurchaseAmount(event.target.value)
                              }
                              placeholder="Enter amount"
                              required
                            />
                          </label>

                          <label className="credit-form-field">
                            Merchant
                            <input
                              type="text"
                              maxLength={100}
                              value={merchant}
                              onChange={(event) =>
                                setMerchant(event.target.value)
                              }
                              placeholder="e.g. Grocery Store"
                            />
                          </label>

                          <label className="credit-form-field credit-form-field-full">
                            Description
                            <input
                              type="text"
                              maxLength={200}
                              value={purchaseDescription}
                              onChange={(event) =>
                                setPurchaseDescription(event.target.value)
                              }
                              placeholder="What was this purchase for?"
                            />
                          </label>
                        </div>

                        <button
                          type="submit"
                          className="credit-button credit-button-primary"
                          disabled={
                            processingPurchase ||
                            !validPurchaseAmount ||
                            purchaseValue * 100 >
                              selectedCard.availableCreditPaise
                          }
                        >
                          {processingPurchase
                            ? "Processing purchase..."
                            : "Make purchase"}
                        </button>

                        <p className="credit-form-note">
                          This is a simulated purchase for your VaultBank
                          project; it does not charge a real merchant.
                        </p>
                      </form>
                    ) : (
                      <p>Your card has no available credit for purchases.</p>
                    )}
                  </div>
                )}

                {/* Repayment form */}
                {(selectedCard.status === "active" ||
                  selectedCard.status === "blocked") && (
                  <div className="credit-action-panel">
                    <div className="credit-history-heading">
                      <div>
                        <h2>Repay credit card</h2>
                        <p>
                          Outstanding balance:{" "}
                          {formatRupees(
                            selectedCard.outstandingBalancePaise
                          )}
                        </p>
                      </div>
                    </div>

                    {outstandingPaise > 0 ? (
                      <form onSubmit={handleRepayment}>
                        <div className="credit-form-grid">
                          <label className="credit-form-field">
                            Pay from bank account
                            <select
                              value={repaymentAccountId}
                              onChange={(event) =>
                                setRepaymentAccountId(event.target.value)
                              }
                              required
                              disabled={
                                loadingAccounts ||
                                activeAccounts.length === 0
                              }
                            >
                              <option value="">
                                {loadingAccounts
                                  ? "Loading accounts..."
                                  : activeAccounts.length === 0
                                    ? "No active bank accounts"
                                    : "Select an account"}
                              </option>

                              {activeAccounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.accountType.toUpperCase()} ·{" "}
                                  {account.accountNumber} · Balance{" "}
                                  {formatRupees(account.balancePaise)}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="credit-form-field">
                            Repayment amount (₹)
                            <input
                              type="number"
                              min="0.01"
                              max={outstandingPaise / 100}
                              step="0.01"
                              value={repaymentAmount}
                              onChange={(event) =>
                                setRepaymentAmount(event.target.value)
                              }
                              placeholder="Enter amount"
                              required
                            />
                          </label>
                        </div>

                        <button
                          type="submit"
                          className="credit-button credit-button-primary"
                          disabled={
                            processingRepayment ||
                            loadingAccounts ||
                            activeAccounts.length === 0 ||
                            !repaymentAccountId ||
                            !validRepaymentAmount
                          }
                        >
                          {processingRepayment
                            ? "Processing repayment..."
                            : "Pay credit card"}
                        </button>

                        <p className="credit-form-note">
                          Repayment will deduct funds from your selected
                          active bank account. Make sure it has enough
                          balance.
                        </p>
                      </form>
                    ) : (
                      <p>
                        Your credit card has no outstanding balance to repay.
                      </p>
                    )}
                  </div>
                )}

                <div className="credit-history-panel">
                  <div className="credit-history-heading">
                    <div>
                      <h2>Transaction history</h2>
                      <p>Purchases and repayments for this card</p>
                    </div>

                    <select
                      className="credit-filter"
                      value={filter}
                      onChange={(event) =>
                        setFilter(event.target.value as TransactionFilter)
                      }
                      aria-label="Filter credit card transactions"
                    >
                      <option value="all">All transactions</option>
                      <option value="purchase">Purchases</option>
                      <option value="repayment">Repayments</option>
                    </select>
                  </div>

                  {loadingHistory ? (
                    <div className="credit-loading credit-history-loading">
                      <span className="credit-spinner" />
                      Loading transaction history...
                    </div>
                  ) : historyError ? (
                    <div className="credit-history-empty" role="alert">
                      <h3>Unable to load transaction history</h3>
                      <p>{historyError}</p>
                      <button
                        type="button"
                        className="credit-button credit-button-secondary"
                        onClick={() => void loadHistory()}
                      >
                        Retry history
                      </button>
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="credit-history-empty">
                      <div className="credit-empty-icon">↔</div>
                      <h3>No transactions found</h3>
                      <p>
                        Purchases and repayments for this card will appear
                        here.
                      </p>
                    </div>
                  ) : (
                    <div className="credit-table-wrapper">
                      <table className="credit-table">
                        <thead>
                          <tr>
                            <th>Transaction</th>
                            <th>Merchant / Details</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th className="credit-amount-column">Amount</th>
                          </tr>
                        </thead>

                        <tbody>
                          {transactions.map((transaction) => {
                            const isRepayment =
                              transaction.type === "credit_card_repayment";

                            return (
                              <tr key={transaction.id}>
                                <td>
                                  <div className="credit-transaction-title">
                                    <span
                                      className={`credit-transaction-icon ${
                                        isRepayment
                                          ? "credit-icon-repayment"
                                          : "credit-icon-purchase"
                                      }`}
                                    >
                                      {isRepayment ? "↓" : "↑"}
                                    </span>

                                    <div>
                                      <strong>
                                        {isRepayment ? "Repayment" : "Purchase"}
                                      </strong>
                                      <small>{transaction.reference}</small>
                                    </div>
                                  </div>
                                </td>

                                <td>
                                  <div className="credit-merchant">
                                    {transaction.merchant || "—"}
                                  </div>
                                  <small className="credit-description">
                                    {transaction.description}
                                  </small>
                                </td>

                                <td className="credit-date">
                                  {formatDate(transaction.createdAt)}
                                </td>

                                <td>
                                  <span
                                    className={`credit-transaction-status credit-transaction-${transaction.status}`}
                                  >
                                    {transaction.status}
                                  </span>
                                </td>

                                <td
                                  className={`credit-amount-column credit-amount ${
                                    isRepayment
                                      ? "credit-amount-positive"
                                      : ""
                                  }`}
                                >
                                  {isRepayment ? "+" : "−"}
                                  {formatRupees(transaction.amountPaise)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )
      )}
    </section>
  );
};

export default CreditCardsView;
