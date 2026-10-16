
import React, { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Shield,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { api, type BankAccount } from "../services/api";

interface DepositsWithdrawalsViewProps {
  token: string;
  accounts: BankAccount[];
  initialTab?: "deposit" | "withdraw";
  initialAccountId?: string;
  onRefreshData: () => Promise<void>;
  onShowReceipt: (receipt: any) => void;
  onToast: (msg: string) => void;
}

export const DepositsWithdrawalsView: React.FC<
  DepositsWithdrawalsViewProps
> = ({
  token,
  accounts,
  initialTab = "deposit",
  initialAccountId,
  onRefreshData,
  onShowReceipt,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">(
    initialTab
  );

  const [selectedAccountId, setSelectedAccountId] = useState(
    initialAccountId || accounts[0]?.id || ""
  );

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Direct Deposit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sync the selected tab when the parent requests a deposit or withdrawal.
  useEffect(() => {
    setActiveTab(initialTab);
    setError("");
  }, [initialTab]);

  // Sync the account when the parent opens this page for a specific account.
  useEffect(() => {
    if (
      initialAccountId &&
      accounts.some((account) => account.id === initialAccountId)
    ) {
      setSelectedAccountId(initialAccountId);
    } else if (
      !accounts.some((account) => account.id === selectedAccountId)
    ) {
      setSelectedAccountId(accounts[0]?.id || "");
    }
  }, [initialAccountId, accounts, selectedAccountId]);

  const activeAccount =
    accounts.find((account) => account.id === selectedAccountId) ||
    accounts[0];

  const balance = activeAccount
    ? activeAccount.balancePaise / 100
    : 0;

  const dailyLimit = activeAccount
    ? (activeAccount.dailyLimitPaise || 5000000) / 100
    : 50000;

  const formatRupees = (value: number) =>
    value.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!activeAccount) {
      setError("Please select a valid bank account.");
      return;
    }

    const numAmount = Number(amount);

    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError("Please enter a valid amount greater than ₹0.");
      return;
    }

    // The API accepts rupees; account balances are stored in paise.
    if (activeTab === "withdraw" && numAmount > balance) {
      setError(
        `Insufficient balance. Current available: ₹${formatRupees(balance)}`
      );
      return;
    }

    if (activeTab === "deposit" && numAmount > 1000000) {
      setError("The maximum simulated deposit per transaction is ₹10,00,000.");
      return;
    }

    const transactionDescription =
      description.trim() ||
      (activeTab === "deposit"
        ? "VaultBank Instant Deposit"
        : "ATM / Wire Cash Withdrawal");

    setLoading(true);

    try {
      let res: any;

      if (activeTab === "deposit") {
        res = await api.deposit(
          token,
          activeAccount.id,
          numAmount,
          transactionDescription,
          category
        );
      } else {
        res = await api.withdraw(
          token,
          activeAccount.id,
          numAmount,
          transactionDescription
        );
      }

      const transactionType =
        activeTab === "deposit" ? "deposit" : "withdrawal";

      onToast(
        `₹${formatRupees(numAmount)} ${
          activeTab === "deposit" ? "deposited" : "withdrawn"
        } successfully!`
      );

      setAmount("");
      setDescription("");

      // Refresh balances and transactions after the API confirms success.
      await onRefreshData();

      if (res?.transaction?.reference) {
        onShowReceipt({
          reference: res.transaction.reference,
          date: new Date().toISOString(),
          type: transactionType,
          category: activeTab === "deposit" ? category : "Withdrawal",
          amount: numAmount,
          description: transactionDescription,
          sender: {
            accountNumber: activeAccount.accountNumber,
          },
        });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Transaction could not be completed.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Deposits &amp; Withdrawals</h1>
          <p className="page-subtitle">
            Manage your funds securely with real-time balance updates and
            transaction checks.
          </p>
        </div>
      </div>

      {/* Transaction Tabs */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className={`btn ${
            activeTab === "deposit" ? "btn-primary" : "btn-secondary"
          }`}
          onClick={() => {
            setActiveTab("deposit");
            setError("");
          }}
          disabled={loading}
        >
          <ArrowDownLeft size={16} />
          Instant Deposit Funds
        </button>

        <button
          type="button"
          className={`btn ${
            activeTab === "withdraw" ? "btn-primary" : "btn-secondary"
          }`}
          onClick={() => {
            setActiveTab("withdraw");
            setError("");
          }}
          disabled={loading}
        >
          <ArrowUpRight size={16} />
          Cash / Wire Withdrawal
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="card-panel">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "var(--text-muted)",
            }}
          >
            <AlertCircle size={20} />
            <div>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--text-main)",
                  marginBottom: 6,
                }}
              >
                No bank accounts available
              </h2>
              <p>
                You need an account before you can deposit or withdraw funds.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* Transaction Form */}
          <div className="card-panel">
            <h2
              style={{
                fontSize: 17,
                fontWeight: 700,
                marginBottom: 18,
                color: "var(--text-main)",
              }}
            >
              {activeTab === "deposit"
                ? "Add Money to Account"
                : "Withdraw Funds"}
            </h2>

            {error && (
              <div
                role="alert"
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "var(--rose)",
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="transaction-account">
                  {activeTab === "deposit"
                    ? "Credit to Bank Account"
                    : "Debit from Bank Account"}
                </label>

                <select
                  id="transaction-account"
                  value={activeAccount?.id || ""}
                  onChange={(e) => {
                    setSelectedAccountId(e.target.value);
                    setError("");
                  }}
                  required
                  disabled={loading}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountNumber} (
                      {account.accountType.toUpperCase()} — Balance: ₹
                      {formatRupees(account.balancePaise / 100)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="transaction-amount">
                  Amount (₹)
                </label>

                <input
                  id="transaction-amount"
                  type="number"
                  min="0.01"
                  max={activeTab === "deposit" ? 1000000 : undefined}
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  disabled={loading}
                />

                <span className="form-hint">
                  {activeTab === "deposit"
                    ? "Maximum simulated deposit per transaction: ₹10,00,000."
                    : `Available account balance: ₹${formatRupees(balance)}`}
                </span>
              </div>

              {activeTab === "deposit" && (
                <div className="form-group">
                  <label
                    className="form-label"
                    htmlFor="deposit-category"
                  >
                    Deposit Source / Category
                  </label>

                  <select
                    id="deposit-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={loading}
                  >
                    <option value="Direct Deposit">
                      Direct Deposit (Salary / Income)
                    </option>
                    <option value="Wire Transfer">
                      Incoming Wire Transfer
                    </option>
                    <option value="Cheque Deposit">
                      Electronic Cheque Deposit
                    </option>
                    <option value="Investment Payout">
                      Investment Payout
                    </option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="transaction-description"
                >
                  Transaction Notes (Optional)
                </label>

                <input
                  id="transaction-description"
                  type="text"
                  placeholder="e.g. Salary, ATM Cash, Monthly savings..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={200}
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                className={`btn ${
                  activeTab === "deposit" ? "btn-primary" : "btn-danger"
                }`}
                style={{
                  width: "100%",
                  marginTop: 12,
                  justifyContent: "center",
                }}
                disabled={loading || !activeAccount}
              >
                {loading ? (
                  <>
                    <Clock size={16} />
                    Processing Request...
                  </>
                ) : activeTab === "deposit" ? (
                  <>
                    <ArrowDownLeft size={16} />
                    Confirm Deposit of ₹
                    {formatRupees(Number(amount || 0))}
                  </>
                ) : (
                  <>
                    <ArrowUpRight size={16} />
                    Confirm Withdrawal of ₹
                    {formatRupees(Number(amount || 0))}
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Account Balance and Safety Panel */}
          <div>
            <div className="card-panel">
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 14,
                  color: "var(--text-main)",
                }}
              >
                Account Overview
              </h3>

              <div style={{ marginBottom: 20 }}>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginBottom: 6,
                  }}
                >
                  Selected Account
                </p>

                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--text-main)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {activeAccount?.accountNumber || "No account selected"}
                </p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginBottom: 6,
                  }}
                >
                  Available Balance
                </p>

                <p
                  className="text-mono"
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "var(--text-main)",
                  }}
                >
                  ₹{formatRupees(balance)}
                </p>
              </div>

              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginBottom: 8,
                  }}
                >
                  <span>Daily Withdrawal Limit</span>
                  <span
                    className="text-mono"
                    style={{
                      color: "var(--text-main)",
                      fontWeight: 600,
                    }}
                  >
                    ₹{formatRupees(dailyLimit)}
                  </span>
                </div>

                <div
                  className="daily-limit-bar"
                  role="progressbar"
                  aria-label="Daily withdrawal limit indicator"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={0}
                >
                  <div
                    className="daily-limit-fill"
                    style={{ width: "0%" }}
                  />
                </div>

                <p
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginTop: 6,
                  }}
                >
                  The indicator will reflect usage when daily limit usage is
                  provided by the backend.
                </p>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  borderRadius: 10,
                  padding: 14,
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                  lineHeight: 1.6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: "var(--emerald)",
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  <Shield size={16} />
                  Secure Transactions
                </div>

                Transactions are submitted to the VaultBank API. Your balance
                and transaction history refresh after the API confirms the
                transaction.
              </div>
            </div>

            <div
              className="card-panel"
              style={{ marginTop: 20 }}
            >
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 12,
                  color: "var(--text-main)",
                }}
              >
                Transaction Checklist
              </h3>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                  marginBottom: 10,
                }}
              >
                <CheckCircle size={16} />
                Confirm the selected account
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                  marginBottom: 10,
                }}
              >
                <CheckCircle size={16} />
                Check the transaction amount
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12.5,
                  color: "var(--text-muted)",
                }}
              >
                <Shield size={16} />
                Verify the transaction result
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
