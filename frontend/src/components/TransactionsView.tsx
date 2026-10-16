

import React, { useMemo, useState } from "react";
import {
  Search,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  ReceiptText,
  CalendarDays,
  X,
  ArrowLeftRight,
  Wallet,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
} from "lucide-react";

import type {
  BankAccount,
  BankTransaction,
} from "../services/api";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

interface TransactionsViewProps {
  token: string;
  accounts: BankAccount[];
  transactions: BankTransaction[];
  onShowReceipt: (receipt: any) => void;
  onOpenStatement: () => void;
}

type TransactionFilter =
  | "all"
  | "deposit"
  | "withdrawal"
  | "transfer"
  | "loan_disbursement"
  | "loan_repayment"
  | "fd_creation"
  | "fd_liquidation";

const TRANSACTION_TYPES: {
  value: TransactionFilter;
  label: string;
}[] = [
  { value: "all", label: "All transaction types" },
  { value: "deposit", label: "Deposits" },
  { value: "withdrawal", label: "Withdrawals" },
  { value: "transfer", label: "Transfers" },
  { value: "loan_disbursement", label: "Loan disbursements" },
  { value: "loan_repayment", label: "Loan repayments" },
  { value: "fd_creation", label: "Fixed deposit placements" },
  { value: "fd_liquidation", label: "Fixed deposit liquidations" },
];

const CREDIT_TYPES = [
  "deposit",
  "loan_disbursement",
  "fd_liquidation",
];

// ------------------------------------------------------------
// Utility functions
// ------------------------------------------------------------

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const formatDate = (value: string | Date): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getLocalDate = (value: string | Date): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalizeAccountId = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }

  return value == null ? "" : String(value);
};

const getTransactionAmount = (
  tx: BankTransaction
): number => {
  if (
    typeof tx.amount === "number" &&
    Number.isFinite(tx.amount)
  ) {
    return Math.abs(tx.amount);
  }

  if (
    typeof tx.amountPaise === "number" &&
    Number.isFinite(tx.amountPaise)
  ) {
    return Math.abs(tx.amountPaise) / 100;
  }

  return 0;
};

const formatLabel = (value: string): string =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const getStatusClass = (status: string): string => {
  switch (status.toLowerCase()) {
    case "completed":
    case "success":
    case "successful":
      return "transaction-status transaction-status-success";

    case "pending":
    case "processing":
      return "transaction-status transaction-status-pending";

    case "failed":
    case "rejected":
      return "transaction-status transaction-status-failed";

    default:
      return "transaction-status";
  }
};

// ------------------------------------------------------------
// Component
// ------------------------------------------------------------

const TransactionsView: React.FC<TransactionsViewProps> = ({
  token,
  accounts,
  transactions,
  onShowReceipt,
  onOpenStatement,
}) => {
  // The parent dashboard is responsible for fetching transactions.
  // Retain the token prop for compatibility with the parent.
  void token;

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] =
    useState<TransactionFilter>("all");
  const [selectedAccountId, setSelectedAccountId] =
    useState("all");
  const [filterDate, setFilterDate] = useState("");

  const safeTransactions = Array.isArray(transactions)
    ? transactions
    : [];

  const safeAccounts = Array.isArray(accounts)
    ? accounts
    : [];

  // ----------------------------------------------------------
  // Filter transactions
  // ----------------------------------------------------------

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return safeTransactions.filter((tx) => {
      if (
        selectedAccountId !== "all" &&
        normalizeAccountId(tx.accountId) !== selectedAccountId
      ) {
        return false;
      }

      if (
        filterType !== "all" &&
        tx.type !== filterType
      ) {
        return false;
      }

      if (
        filterDate &&
        getLocalDate(tx.createdAt) !== filterDate
      ) {
        return false;
      }

      if (query) {
        const searchableFields = [
          tx.reference,
          tx.description,
          tx.recipientDetails,
          tx.category,
          tx.type,
          tx.status,
          tx.accountNumber,
        ];

        const matches = searchableFields.some((field) =>
          String(field ?? "").toLowerCase().includes(query)
        );

        if (!matches) {
          return false;
        }
      }

      return true;
    });
  }, [
    safeTransactions,
    search,
    filterType,
    selectedAccountId,
    filterDate,
  ]);

  // ----------------------------------------------------------
  // Summary calculations
  // ----------------------------------------------------------

  const totalCredits = useMemo(
    () =>
      filteredTransactions.reduce((total, tx) => {
        if (!CREDIT_TYPES.includes(tx.type)) {
          return total;
        }

        return total + getTransactionAmount(tx);
      }, 0),
    [filteredTransactions]
  );

  const totalDebits = useMemo(
    () =>
      filteredTransactions.reduce((total, tx) => {
        if (CREDIT_TYPES.includes(tx.type)) {
          return total;
        }

        return total + getTransactionAmount(tx);
      }, 0),
    [filteredTransactions]
  );

  const hasActiveFilters =
    search.trim() !== "" ||
    filterType !== "all" ||
    selectedAccountId !== "all" ||
    filterDate !== "";

  // ----------------------------------------------------------
  // Actions
  // ----------------------------------------------------------

  const clearFilters = () => {
    setSearch("");
    setFilterType("all");
    setSelectedAccountId("all");
    setFilterDate("");
  };

  const handleShowReceipt = (tx: BankTransaction) => {
    onShowReceipt({
      reference: tx.reference,
      date: tx.createdAt,
      type: tx.type,
      category: tx.category || "General",
      amount: getTransactionAmount(tx),
      currency: tx.currency || "INR",
      status: tx.status,
      description: tx.description || tx.type,
      accountNumber: tx.accountNumber || "",
      recipient: {
        name: tx.recipientDetails || "Direct Payee",
      },
    });
  };

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <section className="transactions-view">
      {/* Page heading */}
      <header className="page-header">
        <div>
          <div className="transaction-eyebrow">
            <ShieldCheck size={15} />
            <span>VaultBank Operations</span>
          </div>

          <h1 className="page-title">
            Transaction Records &amp; Ledger
          </h1>

          <p className="page-subtitle">
            Monitor transaction activity, review account movements,
            and access transaction receipts.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary transaction-statement-button"
          onClick={onOpenStatement}
        >
          <FileText size={17} />
          <span>Generate Statement</span>
        </button>
      </header>

      {/* Summary cards */}
      <div className="transaction-summary-grid">
        <article className="transaction-summary-card">
          <div className="transaction-summary-icon">
            <Wallet size={21} />
          </div>

          <div className="transaction-summary-content">
            <p className="transaction-summary-label">
              Transactions
            </p>

            <h3 className="transaction-summary-value">
              {filteredTransactions.length}
            </h3>

            <span className="transaction-summary-caption">
              Matching current filters
            </span>
          </div>
        </article>

        <article className="transaction-summary-card">
          <div className="transaction-summary-icon transaction-credit-icon">
            <TrendingUp size={21} />
          </div>

          <div className="transaction-summary-content">
            <p className="transaction-summary-label">
              Credits
            </p>

            <h3 className="transaction-summary-value transaction-credit-text">
              {formatCurrency(totalCredits)}
            </h3>

            <span className="transaction-summary-caption">
              Credit transaction types
            </span>
          </div>
        </article>

        <article className="transaction-summary-card">
          <div className="transaction-summary-icon transaction-debit-icon">
            <TrendingDown size={21} />
          </div>

          <div className="transaction-summary-content">
            <p className="transaction-summary-label">
              Debits
            </p>

            <h3 className="transaction-summary-value transaction-debit-text">
              {formatCurrency(totalDebits)}
            </h3>

            <span className="transaction-summary-caption">
              Other transaction types
            </span>
          </div>
        </article>
      </div>

      {/* Search and filters */}
      <section className="card-panel transaction-filters-panel">
        <div className="transaction-filters-heading">
          <div className="transaction-filters-title">
            <RefreshCw size={17} />
            <div>
              <h2>Find Transactions</h2>
              <p>Search and narrow down ledger records</p>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="transaction-clear-filters"
              onClick={clearFilters}
            >
              <X size={14} />
              Clear filters
            </button>
          )}
        </div>

        <div className="transaction-filters-grid">
          {/* Search */}
          <label className="transaction-search-field">
            <Search size={17} aria-hidden="true" />

            <input
              type="search"
              aria-label="Search transactions"
              placeholder="Search reference, description, recipient..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          {/* Account */}
          <select
            aria-label="Filter by account"
            value={selectedAccountId}
            onChange={(event) =>
              setSelectedAccountId(event.target.value)
            }
          >
            <option value="all">
              All Accounts ({safeAccounts.length})
            </option>

            {safeAccounts.map((account) => (
              <option
                key={account.id}
                value={normalizeAccountId(account.id)}
              >
                {account.accountNumber} ({account.accountType})
              </option>
            ))}
          </select>

          {/* Transaction type */}
          <select
            aria-label="Filter by transaction type"
            value={filterType}
            onChange={(event) =>
              setFilterType(event.target.value as TransactionFilter)
            }
          >
            {TRANSACTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          {/* Date */}
          <label className="transaction-date-field">
            <CalendarDays size={16} aria-hidden="true" />

            <input
              type="date"
              aria-label="Filter by transaction date"
              value={filterDate}
              onChange={(event) => setFilterDate(event.target.value)}
            />
          </label>
        </div>

        <div className="transaction-filter-footer">
          <span>
            Showing <strong>{filteredTransactions.length}</strong> of{" "}
            <strong>{safeTransactions.length}</strong> loaded records
          </span>

          {hasActiveFilters && (
            <span className="transaction-filter-active">
              Filters applied
            </span>
          )}
        </div>
      </section>

      {/* Ledger table */}
      <section className="card-panel transaction-ledger-panel">
        <div className="transaction-ledger-header">
          <div>
            <h2 className="transaction-ledger-title">
              Transaction Ledger
            </h2>

            <p className="transaction-ledger-subtitle">
              Detailed record of banking activity
            </p>
          </div>

          <span className="transaction-count-badge">
            {filteredTransactions.length} records
          </span>
        </div>

        <div className="table-responsive">
          <table className="data-table transaction-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Reference ID</th>
                <th>Account</th>
                <th>Transaction Type</th>
                <th>Description</th>
                <th>Category</th>
                <th>Status</th>
                <th className="transaction-amount-heading">
                  Amount
                </th>
                <th className="transaction-receipt-heading">
                  Receipt
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="transaction-empty-cell"
                  >
                    <div className="transaction-empty-state">
                      <div className="transaction-empty-icon">
                        <ReceiptText size={27} />
                      </div>

                      <h3>No transactions found</h3>

                      <p>
                        {safeTransactions.length === 0
                          ? "No transaction records were passed to this page. Verify that the parent dashboard loads the all-transactions API response."
                          : "No transactions match your current filters. Try another search or reset the filters."}
                      </p>

                      {hasActiveFilters && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={clearFilters}
                        >
                          <X size={15} />
                          Reset filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isCredit = CREDIT_TYPES.includes(tx.type);
                  const amount = getTransactionAmount(tx);
                  const typeLabel = formatLabel(tx.type);

                  return (
                    <tr key={tx.id || tx.reference}>
                      {/* Date */}
                      <td className="transaction-date-cell">
                        {formatDate(tx.createdAt)}
                      </td>

                      {/* Reference */}
                      <td>
                        <span className="text-mono transaction-reference">
                          {tx.reference || "—"}
                        </span>
                      </td>

                      {/* Account details */}
                      <td>
                        <div className="transaction-account-cell">
                          <span className="transaction-account-number">
                            {tx.accountNumber ||
                              tx.account?.accountNumber ||
                              "—"}
                          </span>

                          {/* accountType belongs to the transaction
                              object, not the nested account object. */}
                          {tx.accountType && (
                            <span className="transaction-account-type">
                              {tx.accountType}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Type */}
                      <td>
                        <div className="transaction-type-cell">
                          <span
                            className={
                              isCredit
                                ? "transaction-type-icon transaction-type-credit"
                                : "transaction-type-icon transaction-type-debit"
                            }
                          >
                            {tx.type === "transfer" ? (
                              <ArrowLeftRight size={15} />
                            ) : isCredit ? (
                              <ArrowDownLeft size={15} />
                            ) : (
                              <ArrowUpRight size={15} />
                            )}
                          </span>

                          <span className="transaction-type-label">
                            {typeLabel}
                          </span>
                        </div>
                      </td>

                      {/* Description */}
                      <td>
                        <div className="transaction-description">
                          {tx.description || typeLabel}
                        </div>

                        {tx.recipientDetails && (
                          <div className="transaction-recipient">
                            {tx.recipientDetails}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td>
                        <span className="transaction-category">
                          {tx.category || "General"}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          className={getStatusClass(
                            String(tx.status || "unknown")
                          )}
                        >
                          <span className="transaction-status-dot" />
                          {formatLabel(
                            String(tx.status || "Unknown")
                          )}
                        </span>
                      </td>

                      {/* Amount */}
                      <td
                        className={
                          isCredit
                            ? "transaction-amount transaction-credit-text"
                            : "transaction-amount transaction-debit-text"
                        }
                      >
                        <span className="transaction-amount-sign">
                          {isCredit ? "+" : "−"}
                        </span>

                        {formatCurrency(amount)}
                      </td>

                      {/* Receipt */}
                      <td className="transaction-receipt-cell">
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleShowReceipt(tx)}
                          title={`View receipt for ${tx.reference}`}
                        >
                          <ReceiptText size={14} />
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

        <footer className="transaction-ledger-footer">
          <span>
            Displaying {filteredTransactions.length} transaction
            {filteredTransactions.length === 1 ? "" : "s"}
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              className="transaction-clear-filters"
              onClick={clearFilters}
            >
              Reset search and filters
            </button>
          )}
        </footer>
      </section>
    </section>
  );
};

export default TransactionsView;
