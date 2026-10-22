
import React, { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  FileText,
  Copy,
  Check,
  CreditCard,
  ShieldCheck,
  Eye,
  EyeOff,
  Landmark,
  Award,
  Clock3,
  ChevronRight,
  Wallet,
  Users,
} from "lucide-react";

import type {
  BankAccount,
  BankTransaction,
  Beneficiary,
  FixedDeposit,
  Loan,
} from "../services/api";

interface CustomerDashboardProps {
  accounts: BankAccount[];
  transactions: BankTransaction[];
  beneficiaries: Beneficiary[];
  loans: Loan[];
  fixedDeposits: FixedDeposit[];
  onNavigate: (page: string) => void;
  onOpenDeposit: (accountId?: string) => void;
  onOpenWithdraw: (accountId?: string) => void;
  onOpenTransfer: (accountId?: string) => void;
  onOpenStatement: () => void;
  onShowReceipt: (receipt: any) => void;
  onToast: (msg: string) => void;
}

const formatCurrency = (amount: number) =>
  `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const isCreditTransaction = (type: string) =>
  type === "deposit" ||
  type === "loan_disbursement" ||
  type === "fd_liquidation";

const formatTransactionType = (type: string) =>
  type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  accounts,
  transactions,
  beneficiaries,
  loans,
  fixedDeposits,
  onNavigate,
  onOpenDeposit,
  onOpenWithdraw,
  onOpenTransfer,
  onOpenStatement,
  onShowReceipt,
  onToast,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState(
    accounts[0]?.id || ""
  );
  const [showBalance, setShowBalance] = useState(true);
  const [copied, setCopied] = useState(false);

  // Keep the selected account valid if accounts arrive asynchronously.
  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedAccountId("");
      return;
    }

    if (!accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const activeAccount =
    accounts.find((account) => account.id === selectedAccountId) ||
    accounts[0];

  const balance = activeAccount ? activeAccount.balancePaise / 100 : 0;
  const dailyLimit = activeAccount
    ? (activeAccount.dailyLimitPaise || 5_000_000) / 100
    : 50_000;

  const totalMoneyIn = transactions
    .filter((transaction) => isCreditTransaction(transaction.type))
    .reduce(
      (sum, transaction) =>
        sum + (transaction.amount ?? transaction.amountPaise / 100),
      0
    );

  const totalMoneyOut = transactions
    .filter((transaction) => !isCreditTransaction(transaction.type))
    .reduce(
      (sum, transaction) =>
        sum + (transaction.amount ?? transaction.amountPaise / 100),
      0
    );

  const totalFdValue = fixedDeposits
    .filter((deposit) => deposit.status === "active")
    .reduce((sum, deposit) => sum + deposit.amount, 0);

  const totalLoanDebt = loans
    .filter((loan) => loan.status === "approved")
    .reduce((sum, loan) => sum + loan.remainingAmount, 0);

  const activeLoanCount = loans.filter(
    (loan) => loan.status === "approved"
  ).length;

  const activeFdCount = fixedDeposits.filter(
    (deposit) => deposit.status === "active"
  ).length;

  const recentTransactions = transactions.slice(0, 5);

  const copyAccountNumber = async () => {
    if (!activeAccount) return;

    try {
      await navigator.clipboard.writeText(activeAccount.accountNumber);
      setCopied(true);
      onToast("Account number copied successfully!");

      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast("Could not copy the account number. Please copy it manually.");
    }
  };

  return (
    <div className="customer-dashboard">
      <div className="dashboard-welcome">
        <div>
          <div className="dashboard-eyebrow">
            <span className="dashboard-eyebrow-dot" />
            YOUR FINANCIAL OVERVIEW
          </div>
          <h1 className="dashboard-heading">Your money, in good hands.</h1>
          <p className="dashboard-description">
            Manage your accounts, track your spending, and move money with
            confidence.
          </p>
        </div>

        <button className="btn btn-secondary dashboard-statement-btn" onClick={onOpenStatement}>
          <FileText size={16} />
          Get statement
        </button>
      </div>

      {accounts.length > 1 && (
        <section className="dashboard-account-switcher" aria-label="Select account">
          <div className="account-switcher-label">
            <Landmark size={16} />
            <span>Your accounts</span>
          </div>

          <div className="account-switcher-list">
            {accounts.map((account) => {
              const selected = activeAccount?.id === account.id;

              return (
                <button
                  key={account.id}
                  className={`account-switcher-item ${selected ? "selected" : ""}`}
                  onClick={() => setSelectedAccountId(account.id)}
                  aria-pressed={selected}
                >
                  <span className="account-switcher-type">
                    {account.accountType}
                  </span>
                  <span className="account-switcher-number">
                    •••• {account.accountNumber.slice(-4)}
                  </span>
                  {selected && <Check size={15} />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="hero-balance-card dashboard-balance-hero">
        <div className="dashboard-hero-decoration" aria-hidden="true">
          <Landmark size={150} strokeWidth={0.6} />
        </div>

        <div className="hero-balance-header dashboard-hero-top">
          <div>
            <div className="hero-account-type">
              {activeAccount?.accountType || "Savings"} account
            </div>

            <div className="hero-account-number">
              <span>{activeAccount?.accountNumber || "No account selected"}</span>

              {activeAccount && (
                <button
                  className="dashboard-copy-button"
                  onClick={copyAccountNumber}
                  title="Copy account number"
                  aria-label="Copy account number"
                >
                  {copied ? (
                    <Check size={15} />
                  ) : (
                    <Copy size={15} />
                  )}
                </button>
              )}
            </div>
          </div>

          <span className="dashboard-secure-label">
            <ShieldCheck size={15} />
            Secure account
          </span>
        </div>

        <div className="dashboard-balance-content">
          <div className="dashboard-balance-label">
            Available balance
            <button
              className="dashboard-balance-toggle"
              onClick={() => setShowBalance((current) => !current)}
              aria-label={showBalance ? "Hide balance" : "Show balance"}
            >
              {showBalance ? <EyeOff size={16} /> : <Eye size={16} />}
              <span>{showBalance ? "Hide" : "Show"}</span>
            </button>
          </div>

          <div className="hero-balance-amount dashboard-balance-value">
            {showBalance ? formatCurrency(balance) : "₹ ••••••"}
          </div>

          <div className="dashboard-balance-caption">
            <span className="dashboard-status-dot" />
            {activeAccount ? "Your account is ready to use" : "No account available"}
          </div>
        </div>

        <div className="dashboard-hero-divider" />

        <div className="hero-actions dashboard-quick-actions">
          <button
            className="btn-hero primary"
            onClick={() => onOpenTransfer(activeAccount?.id)}
            disabled={!activeAccount}
          >
            <ArrowLeftRight size={16} />
            Transfer
          </button>

          <button
            className="btn-hero"
            onClick={() => onOpenDeposit(activeAccount?.id)}
            disabled={!activeAccount}
          >
            <ArrowDownLeft size={16} />
            Deposit
          </button>

          <button
            className="btn-hero"
            onClick={() => onOpenWithdraw(activeAccount?.id)}
            disabled={!activeAccount}
          >
            <ArrowUpRight size={16} />
            Withdraw
          </button>

          <button
            className="btn-hero"
            onClick={() => onNavigate("loans")}
          >
            <CreditCard size={16} />
            Loans
          </button>

          <button
            className="btn-hero"
            onClick={() => onNavigate("fixed-deposits")}
          >
            <Award size={16} />
            Fixed deposits
          </button>
        </div>

        <div className="dashboard-limit">
          <div className="dashboard-limit-heading">
            <div>
              <span className="dashboard-limit-title">Daily transfer limit</span>
              <span className="dashboard-limit-caption">
                Your account's configured daily allowance
              </span>
            </div>
            <strong>{formatCurrency(dailyLimit)}</strong>
          </div>

          <div className="daily-limit-bar">
            <div className="daily-limit-fill" style={{ width: "0%" }} />
          </div>
          <p className="dashboard-limit-footnote">
            Usage details are shown when supported by transaction-limit data.
          </p>
        </div>
      </section>

      <div className="dashboard-section-heading">
        <div>
          <h2>Financial snapshot</h2>
          <p>A quick look at your banking activity.</p>
        </div>
      </div>

      <section className="stats-grid dashboard-financial-grid">
        <article className="stat-card dashboard-metric-card">
          <div className="stat-card-header">
            <span className="stat-label">Money received</span>
            <div className="stat-icon dashboard-metric-icon credit">
              <ArrowDownLeft size={19} />
            </div>
          </div>
          <div className="stat-value">{formatCurrency(totalMoneyIn)}</div>
          <div className="stat-footer">
            <span className="dashboard-metric-dot credit-dot" />
            Incoming transactions in the loaded history
          </div>
        </article>

        <article className="stat-card dashboard-metric-card">
          <div className="stat-card-header">
            <span className="stat-label">Money sent</span>
            <div className="stat-icon dashboard-metric-icon debit">
              <ArrowUpRight size={19} />
            </div>
          </div>
          <div className="stat-value">{formatCurrency(totalMoneyOut)}</div>
          <div className="stat-footer">
            <span className="dashboard-metric-dot debit-dot" />
            Outgoing transactions in the loaded history
          </div>
        </article>

        <article className="stat-card dashboard-metric-card">
          <div className="stat-card-header">
            <span className="stat-label">Fixed deposits</span>
            <div className="stat-icon dashboard-metric-icon savings">
              <Award size={19} />
            </div>
          </div>
          <div className="stat-value">{formatCurrency(totalFdValue)}</div>
          <div className="stat-footer">
            {activeFdCount} active {activeFdCount === 1 ? "deposit" : "deposits"}
          </div>
        </article>

        <article className="stat-card dashboard-metric-card">
          <div className="stat-card-header">
            <span className="stat-label">Outstanding loans</span>
            <div className="stat-icon dashboard-metric-icon loan">
              <Wallet size={19} />
            </div>
          </div>
          <div className="stat-value">{formatCurrency(totalLoanDebt)}</div>
          <div className="stat-footer">
            {activeLoanCount} approved {activeLoanCount === 1 ? "loan" : "loans"}
          </div>
        </article>
      </section>

      <section className="dashboard-bottom-grid">
        <div className="card-panel dashboard-transactions-panel">
          <div className="card-panel-header">
            <div className="dashboard-panel-title">
              <div className="dashboard-panel-icon">
                <Clock3 size={17} />
              </div>
              <div>
                <h3>Recent transactions</h3>
                <p>Your latest account activity</p>
              </div>
            </div>

            <button
              className="btn btn-sm btn-secondary dashboard-view-all"
              onClick={() => onNavigate("transactions")}
            >
              View all
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table dashboard-transactions-table">
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Receipt</th>
                </tr>
              </thead>

              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="dashboard-empty-state">
                        <div className="dashboard-empty-icon">
                          <FileText size={22} />
                        </div>
                        <strong>No transactions yet</strong>
                        <span>
                          Your recent account activity will appear here.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((transaction) => {
                    const isCredit = isCreditTransaction(transaction.type);
                    const amount =
                      transaction.amount ??
                      transaction.amountPaise / 100;

                    return (
                      <tr key={transaction.id || transaction.reference}>
                        <td>
                          <div className="dashboard-transaction-name">
                            <span
                              className={`dashboard-transaction-icon ${
                                isCredit ? "credit" : "debit"
                              }`}
                            >
                              {isCredit ? (
                                <ArrowDownLeft size={16} />
                              ) : (
                                <ArrowUpRight size={16} />
                              )}
                            </span>

                            <span className="dashboard-transaction-info">
                              <strong>
                                {transaction.description ||
                                  formatTransactionType(transaction.type)}
                              </strong>
                              <span>
                                {transaction.reference || "Reference unavailable"}
                              </span>
                            </span>
                          </div>
                        </td>

                        <td>
                          <span className="dashboard-transaction-date">
                            {new Date(transaction.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`dashboard-transaction-amount ${
                              isCredit ? "credit" : "debit"
                            }`}
                          >
                            {isCredit ? "+" : "−"}
                            {formatCurrency(amount)}
                          </span>
                        </td>

                        <td>
                          <button
                            className="dashboard-receipt-button"
                            onClick={() =>
                              onShowReceipt({
                                reference: transaction.reference,
                                date: transaction.createdAt,
                                type: transaction.type,
                                category: transaction.category,
                                amount,
                                description: transaction.description,
                                status: transaction.status,
                                recipient: {
                                  name:
                                    transaction.recipientDetails ||
                                    "Direct Payee",
                                },
                              })
                            }
                          >
                            <FileText size={14} />
                            <span>Receipt</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <button
            className="dashboard-mobile-view-all"
            onClick={() => onNavigate("transactions")}
          >
            View complete transaction history
            <ChevronRight size={16} />
          </button>
        </div>

        <aside className="card-panel dashboard-beneficiaries-panel">
          <div className="card-panel-header">
            <div className="dashboard-panel-title">
              <div className="dashboard-panel-icon">
                <Users size={17} />
              </div>
              <div>
                <h3>Quick transfer</h3>
                <p>Your saved beneficiaries</p>
              </div>
            </div>

            <button
              className="dashboard-manage-link"
              onClick={() => onNavigate("transfer")}
            >
              Manage
            </button>
          </div>

          {beneficiaries.length === 0 ? (
            <div className="dashboard-empty-beneficiaries">
              <div className="dashboard-empty-icon">
                <Users size={22} />
              </div>
              <strong>No saved beneficiaries</strong>
              <p>
                Add people you transfer money to frequently for easier access.
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => onNavigate("transfer")}
              >
                Manage beneficiaries
                <ChevronRight size={15} />
              </button>
            </div>
          ) : (
            <div className="dashboard-beneficiary-list">
              {beneficiaries.slice(0, 5).map((beneficiary) => (
                <div
                  key={beneficiary.id}
                  className="dashboard-beneficiary"
                >
                  <div className="dashboard-beneficiary-avatar">
                    {beneficiary.name.trim().charAt(0).toUpperCase() || "B"}
                  </div>

                  <div className="dashboard-beneficiary-info">
                    <strong>{beneficiary.name}</strong>
                    <span>
                      •••• {beneficiary.accountNumber.slice(-4)}
                    </span>
                  </div>

                  <button
                    className="dashboard-send-button"
                    onClick={() => onOpenTransfer(activeAccount?.id)}
                    disabled={!activeAccount}
                    aria-label={`Transfer to ${beneficiary.name}`}
                  >
                    Send
                  </button>
                </div>
              ))}

              <button
                className="dashboard-add-beneficiary"
                onClick={() => onNavigate("transfer")}
              >
                <span>
                  <Users size={15} />
                  Manage saved beneficiaries
                </span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
};
