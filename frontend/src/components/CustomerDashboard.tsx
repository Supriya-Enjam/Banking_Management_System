import React, { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  FileText,
  Plus,
  Copy,
  Check,
  TrendingUp,
  CreditCard,
  ShieldCheck,
  Eye,
  EyeOff,
  Landmark,
  Award,
} from "lucide-react";
import type { BankAccount, BankTransaction, Beneficiary, FixedDeposit, Loan } from "../services/api";

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
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || "");
  const [showBalance, setShowBalance] = useState(true);
  const [copied, setCopied] = useState(false);

  const activeAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  const balance = activeAccount ? activeAccount.balancePaise / 100 : 0;
  const dailyLimit = activeAccount ? (activeAccount.dailyLimitPaise || 5000000) / 100 : 50000;

  // Calculate stats
  const totalMoneyIn = transactions
    .filter((t) => t.type === "deposit" || t.type === "loan_disbursement" || t.type === "fd_liquidation")
    .reduce((sum, t) => sum + (t.amount || t.amountPaise / 100), 0);

  const totalMoneyOut = transactions
    .filter((t) => t.type !== "deposit" && t.type !== "loan_disbursement" && t.type !== "fd_liquidation")
    .reduce((sum, t) => sum + (t.amount || t.amountPaise / 100), 0);

  const totalFdValue = fixedDeposits
    .filter((f) => f.status === "active")
    .reduce((sum, f) => sum + f.amount, 0);

  const totalLoanDebt = loans
    .filter((l) => l.status === "approved")
    .reduce((sum, l) => sum + l.remainingAmount, 0);

  const copyAccountNumber = () => {
    if (activeAccount) {
      navigator.clipboard.writeText(activeAccount.accountNumber);
      setCopied(true);
      onToast(`Account ${activeAccount.accountNumber} copied!`);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const recentTransactions = transactions.slice(0, 5);

  return (
    <div>
      {/* Account Selector Tabs if multiple */}
      {accounts.length > 1 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 18, overflowX: "auto", paddingBottom: 4 }}>
          {accounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => setSelectedAccountId(acc.id)}
              style={{
                background: selectedAccountId === acc.id ? "var(--bg-card-hover)" : "var(--bg-card)",
                border: selectedAccountId === acc.id ? "1px solid var(--emerald)" : "1px solid var(--border-subtle)",
                borderRadius: 10,
                padding: "8px 16px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: selectedAccountId === acc.id ? "var(--text-main)" : "var(--text-muted)",
              }}
            >
              <Landmark size={14} className={selectedAccountId === acc.id ? "text-emerald" : ""} />
              <span style={{ fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>{acc.accountType}</span>
              <span className="text-mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>{acc.accountNumber.slice(-6)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Hero Balance Card */}
      <div className="hero-balance-card">
        <div className="hero-balance-header">
          <div>
            <div className="hero-account-type">
              {activeAccount?.accountType || "Savings"} Account • Primary Liquidity
            </div>
            <div className="hero-account-number">
              {activeAccount?.accountNumber || "—"}
              <button
                onClick={copyAccountNumber}
                style={{ color: "rgba(255,255,255,0.7)", padding: 4 }}
                title="Copy Account Number"
              >
                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowBalance(!showBalance)}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff",
              padding: "6px 12px",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
            }}
          >
            {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
            {showBalance ? "Hide Balance" : "Show Balance"}
          </button>
        </div>

        <div>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "rgba(255,255,255,0.7)" }}>
            Available Ledger Balance
          </div>
          <div className="hero-balance-amount">
            {showBalance
              ? `₹${balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
              : "₹••••••••"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#10b981" }}>
            <ShieldCheck size={16} /> Verified Active & Insured
          </div>
        </div>

        {/* Quick Actions */}
        <div className="hero-actions">
          <button className="btn-hero primary" onClick={() => onOpenTransfer(activeAccount?.id)}>
            <ArrowLeftRight size={15} /> Send Money
          </button>
          <button className="btn-hero" onClick={() => onOpenDeposit(activeAccount?.id)}>
            <ArrowDownLeft size={15} /> Deposit
          </button>
          <button className="btn-hero" onClick={() => onOpenWithdraw(activeAccount?.id)}>
            <ArrowUpRight size={15} /> Withdraw
          </button>
          <button className="btn-hero" onClick={() => onNavigate("loans")}>
            <CreditCard size={15} /> Apply Loan
          </button>
          <button className="btn-hero" onClick={() => onNavigate("fixed-deposits")}>
            <Award size={15} /> New FD
          </button>
          <button className="btn-hero" onClick={onOpenStatement}>
            <FileText size={15} /> Statement
          </button>
        </div>

        {/* Daily Limit Bar */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.15)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
            <span>Daily Electronic Limit Allowance</span>
            <span className="text-mono">Limit: ₹{dailyLimit.toLocaleString()}</span>
          </div>
          <div className="daily-limit-bar">
            <div className="daily-limit-fill" style={{ width: "28%" }} />
          </div>
        </div>
      </div>

      {/* Key Financial Metrics */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total Credits (Inflow)</span>
            <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--emerald)" }}>
              <ArrowDownLeft size={20} />
            </div>
          </div>
          <div className="stat-value">₹{totalMoneyIn.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
          <div className="stat-footer">Incoming deposits and disbursements</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total Debits (Outflow)</span>
            <div className="stat-icon" style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--rose)" }}>
              <ArrowUpRight size={20} />
            </div>
          </div>
          <div className="stat-value">₹{totalMoneyOut.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
          <div className="stat-footer">Transfers, withdrawals, and payments</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Fixed Deposit Value</span>
            <div className="stat-icon" style={{ background: "rgba(59, 130, 246, 0.1)", color: "var(--sapphire)" }}>
              <Award size={20} />
            </div>
          </div>
          <div className="stat-value">₹{totalFdValue.toLocaleString()}</div>
          <div className="stat-footer">{fixedDeposits.length} active certificates</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Outstanding Loans</span>
            <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.1)", color: "var(--amber)" }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div className="stat-value">₹{totalLoanDebt.toLocaleString()}</div>
          <div className="stat-footer">{loans.filter((l) => l.status === "approved").length} active loan facilities</div>
        </div>
      </div>

      {/* Bottom Section: Recent Activity + Frequent Payees */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr", gap: 24 }}>
        {/* Recent Transactions */}
        <div className="card-panel">
          <div className="card-panel-header">
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>Recent Transactions</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => onNavigate("transactions")}>
              View All History
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Date</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th style={{ textAlign: "center" }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                      No recent transactions found.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((tx) => {
                    const isCredit = tx.type === "deposit" || tx.type === "loan_disbursement" || tx.type === "fd_liquidation";
                    const amt = tx.amount || (tx.amountPaise ? tx.amountPaise / 100 : 0);
                    return (
                      <tr key={tx.id || tx.reference}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{tx.description || tx.type}</div>
                          <div className="text-mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>{tx.reference}</div>
                        </td>
                        <td style={{ fontSize: 12 }}>{new Date(tx.createdAt).toLocaleDateString("en-IN")}</td>
                        <td>
                          <span style={{ fontSize: 11, background: "rgba(255,255,255,0.04)", padding: "3px 8px", borderRadius: 4 }}>
                            {tx.category || "General"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }} className={isCredit ? "text-emerald" : "text-rose"}>
                          {isCredit ? "+" : "-"}₹{amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() =>
                              onShowReceipt({
                                reference: tx.reference,
                                date: tx.createdAt,
                                type: tx.type,
                                category: tx.category,
                                amount: amt,
                                description: tx.description,
                                status: tx.status,
                                recipient: { name: tx.recipientDetails || "Direct Payee" },
                              })
                            }
                          >
                            Receipt
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Send to Saved Payees */}
        <div className="card-panel">
          <div className="card-panel-header">
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>Quick Transfer</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => onNavigate("transfer")}>
              Manage
            </button>
          </div>

          {beneficiaries.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0", textAlign: "center" }}>
              No saved beneficiaries. Add frequent payees in the Transfer section for quick sending.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {beneficiaries.slice(0, 4).map((b) => (
                <div
                  key={b.id}
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{b.name}</div>
                    <div className="text-mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>{b.accountNumber}</div>
                  </div>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => onNavigate("transfer")}
                  >
                    Send
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
