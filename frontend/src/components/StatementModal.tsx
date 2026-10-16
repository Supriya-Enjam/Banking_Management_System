import React, { useState, useMemo } from "react";
import { X, Download, Printer, FileText, Calendar, Filter } from "lucide-react";
import type { BankAccount, BankTransaction } from "../services/api";

interface StatementModalProps {
  accounts: BankAccount[];
  transactions: BankTransaction[];
  onClose: () => void;
}

export const StatementModal: React.FC<StatementModalProps> = ({ accounts, transactions, onClose }) => {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || "all");
  const [dateRange, setDateRange] = useState("30"); // 30 days, 90 days, 365 days, all
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId),
    [accounts, selectedAccountId]
  );

  const filteredTransactions = useMemo(() => {
    let list = [...transactions];

    if (selectedAccountId !== "all") {
      list = list.filter((t) => t.accountId === selectedAccountId);
    }

    const now = new Date();
    if (dateRange === "30") {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      list = list.filter((t) => new Date(t.createdAt) >= past);
    } else if (dateRange === "90") {
      const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      list = list.filter((t) => new Date(t.createdAt) >= past);
    } else if (dateRange === "365") {
      const past = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      list = list.filter((t) => new Date(t.createdAt) >= past);
    } else if (dateRange === "custom") {
      if (customStart) list = list.filter((t) => new Date(t.createdAt) >= new Date(customStart));
      if (customEnd) {
        const end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
        list = list.filter((t) => new Date(t.createdAt) <= end);
      }
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transactions, selectedAccountId, dateRange, customStart, customEnd]);

  const summary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;

    filteredTransactions.forEach((tx) => {
      const amt = tx.amount || (tx.amountPaise ? tx.amountPaise / 100 : 0);
      if (tx.type === "deposit" || tx.type === "loan_disbursement" || tx.type === "fd_liquidation") {
        totalIn += amt;
      } else {
        totalOut += amt;
      }
    });

    return {
      totalIn,
      totalOut,
      netFlow: totalIn - totalOut,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  const downloadCSV = () => {
    const headers = ["Date", "Reference", "Type", "Category", "Description", "Recipient", "Amount (INR)", "Status"];
    const rows = filteredTransactions.map((tx) => [
      `"${new Date(tx.createdAt).toLocaleDateString("en-IN")}"`,
      `"${tx.reference}"`,
      `"${tx.type}"`,
      `"${tx.category || 'General'}"`,
      `"${(tx.description || '').replace(/"/g, '""')}"`,
      `"${(tx.recipientDetails || '').replace(/"/g, '""')}"`,
      tx.type === "deposit" ? `+${tx.amount || tx.amountPaise / 100}` : `-${tx.amount || tx.amountPaise / 100}`,
      `"${tx.status}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `VaultBank_Statement_${selectedAccount?.accountNumber || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card printable-card" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header no-print">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={20} className="text-emerald" />
            <span className="modal-title">Account Statement Generator</span>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Controls - Hidden in Print */}
          <div className="no-print" style={{ background: "rgba(255,255,255,0.03)", padding: 18, borderRadius: 12, marginBottom: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Select Account</label>
                <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
                  <option value="all">All Linked Accounts</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountNumber} ({acc.accountType.toUpperCase()} - ₹{(acc.balancePaise / 100).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Date Range</label>
                <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 3 Months (Quarter)</option>
                  <option value="365">Last 12 Months (Financial Year)</option>
                  <option value="all">Complete History</option>
                  <option value="custom">Custom Date Interval</option>
                </select>
              </div>
            </div>

            {dateRange === "custom" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Start Date</label>
                  <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">End Date</label>
                  <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Statement Printable Area */}
          <div style={{ padding: "10px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid var(--border-subtle)", paddingBottom: 16, marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-main)" }}>VAULTBANK</h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Official Account Statement & Ledger</p>
                <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-muted)" }}>
                  Account: <strong style={{ color: "var(--text-main)" }}>{selectedAccount ? `${selectedAccount.accountNumber} (${selectedAccount.accountType.toUpperCase()})` : "All Accounts Combined"}</strong>
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: 12, color: "var(--text-muted)" }}>
                <div>Generated: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                <div>Status: <span className="text-emerald" style={{ fontWeight: 600 }}>Active</span></div>
              </div>
            </div>

            {/* Summary Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "rgba(16, 185, 129, 0.08)", padding: 14, borderRadius: 10, border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                <div style={{ fontSize: 11, color: "var(--emerald)", fontWeight: 700, textTransform: "uppercase" }}>Total Credits (+)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginTop: 4 }}>
                  ₹{summary.totalIn.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ background: "rgba(239, 68, 68, 0.08)", padding: 14, borderRadius: 10, border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                <div style={{ fontSize: 11, color: "var(--rose)", fontWeight: 700, textTransform: "uppercase" }}>Total Debits (-)</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginTop: 4 }}>
                  ₹{summary.totalOut.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ background: "rgba(59, 130, 246, 0.08)", padding: 14, borderRadius: 10, border: "1px solid rgba(59, 130, 246, 0.2)" }}>
                <div style={{ fontSize: 11, color: "var(--sapphire)", fontWeight: 700, textTransform: "uppercase" }}>Net Cashflow</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: summary.netFlow >= 0 ? "var(--emerald)" : "var(--rose)", marginTop: 4 }}>
                  {summary.netFlow >= 0 ? "+" : ""}₹{summary.netFlow.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Statement Line Items */}
            <div className="table-responsive" style={{ maxHeight: 320, overflowY: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                        No transactions found for the specified period.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const isIncome = tx.type === "deposit" || tx.type === "loan_disbursement" || tx.type === "fd_liquidation";
                      const amt = tx.amount || (tx.amountPaise ? tx.amountPaise / 100 : 0);
                      return (
                        <tr key={tx.id || tx.reference}>
                          <td>{new Date(tx.createdAt).toLocaleDateString("en-IN")}</td>
                          <td className="text-mono" style={{ fontSize: 11.5 }}>{tx.reference}</td>
                          <td>
                            <span className={`status-pill ${isIncome ? 'completed' : 'pending'}`}>
                              {tx.type}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{tx.description || tx.type}</div>
                            {tx.recipientDetails && <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{tx.recipientDetails}</div>}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700 }} className={isIncome ? "text-emerald" : "text-rose"}>
                            {isIncome ? "+" : "-"}₹{amt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="modal-footer no-print">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-secondary" onClick={downloadCSV}>
            <Download size={16} /> Download CSV
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
};
