import React, { useState } from "react";
import { Plus, Landmark, Copy, Check, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Shield } from "lucide-react";
import { api, type BankAccount } from "../services/api";

interface AccountsViewProps {
  token: string;
  accounts: BankAccount[];
  onRefreshData: () => Promise<void>;
  onOpenDeposit: (accountId: string) => void;
  onOpenWithdraw: (accountId: string) => void;
  onOpenTransfer: (accountId: string) => void;
  onToast: (msg: string) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  token,
  accounts,
  onRefreshData,
  onOpenDeposit,
  onOpenWithdraw,
  onOpenTransfer,
  onToast,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [accountType, setAccountType] = useState<"savings" | "current" | "business">("savings");
  const [initialDeposit, setInitialDeposit] = useState(1000);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (accNum: string) => {
    navigator.clipboard.writeText(accNum);
    setCopiedId(accNum);
    onToast(`Account ${accNum} copied to clipboard!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreating(true);

    try {
      await api.createAccount(token, accountType, initialDeposit);
      onToast(`New ${accountType.toUpperCase()} account created successfully!`);
      setShowCreateModal(false);
      await onRefreshData();
    } catch (err: any) {
      setError(err.message || "Failed to create account.");
    } finally {
      setCreating(false);
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balancePaise / 100), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bank Accounts Portfolio</h1>
          <p className="page-subtitle">Manage multi-currency savings, current accounts, and commercial business accounts</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} /> Open New Account
        </button>
      </div>

      {/* Aggregate Overview Card */}
      <div style={{ background: "linear-gradient(135deg, #10214a, #0b1428)", border: "1px solid var(--border-subtle)", borderRadius: 16, padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Total Combined Portfolio Balance
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", marginTop: 4 }}>
            ₹{totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Active Accounts</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--emerald)" }}>{accounts.length} Accounts</div>
          </div>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="accounts-grid">
        {accounts.map((acc) => {
          const bal = acc.balancePaise / 100;
          const limit = (acc.dailyLimitPaise || 5000000) / 100;
          return (
            <div key={acc.id} className="account-card">
              <div>
                <div className="account-card-top">
                  <span className={`account-type-tag ${acc.accountType}`}>
                    {acc.accountType}
                  </span>
                  <span className={`status-pill ${acc.status}`}>
                    {acc.status}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div className="account-number">{acc.accountNumber}</div>
                  <button
                    style={{ color: "var(--text-faint)", padding: 4 }}
                    onClick={() => handleCopy(acc.accountNumber)}
                    title="Copy Account Number"
                  >
                    {copiedId === acc.accountNumber ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  </button>
                </div>

                <div className="account-balance">
                  ₹{bal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>

                <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 12 }}>
                  Daily Transfer Limit: ₹{limit.toLocaleString()}
                </div>
              </div>

              <div className="account-card-actions">
                <button className="btn btn-sm btn-secondary" style={{ flex: 1 }} onClick={() => onOpenDeposit(acc.id)}>
                  <ArrowDownLeft size={13} /> Deposit
                </button>
                <button className="btn btn-sm btn-secondary" style={{ flex: 1 }} onClick={() => onOpenWithdraw(acc.id)}>
                  <ArrowUpRight size={13} /> Withdraw
                </button>
                <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => onOpenTransfer(acc.id)}>
                  <ArrowLeftRight size={13} /> Send
                </button>
              </div>
            </div>
          );
        })}

        {/* Add Account Card */}
        <div
          className="account-card"
          style={{
            borderStyle: "dashed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            minHeight: 200,
          }}
          onClick={() => setShowCreateModal(true)}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--emerald)" }}>
              <Plus size={22} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)" }}>Open Another Account</div>
            <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Savings, Current, or Business Checking</div>
          </div>
        </div>
      </div>

      {/* Modal: Open New Account */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Open New Bank Account</span>
              <button className="icon-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateAccount}>
              <div className="modal-body">
                {error && (
                  <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--rose)", padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                    {error}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Account Type</label>
                  <select value={accountType} onChange={(e) => setAccountType(e.target.value as any)}>
                    <option value="savings">Savings Account (4.0% p.a. interest, ₹1,00,000 daily limit)</option>
                    <option value="current">Current / Checking Account (Zero fees, ₹2,00,000 daily limit)</option>
                    <option value="business">Commercial Business Account (₹5,00,000 daily limit, priority teller)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Initial Opening Deposit (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={initialDeposit}
                    onChange={(e) => setInitialDeposit(Number(e.target.value))}
                  />
                  <span className="form-hint">Zero minimum balance requirement.</span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? "Opening Account..." : "Confirm & Open Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
