import React, { useState, useEffect } from "react";
import { TrendingUp, Award, Calendar, DollarSign, AlertCircle, ShieldCheck, ArrowDownRight } from "lucide-react";
import { api, type BankAccount, type FixedDeposit } from "../services/api";

interface FixedDepositViewProps {
  token: string;
  accounts: BankAccount[];
  fixedDeposits: FixedDeposit[];
  onRefreshData: () => Promise<void>;
  onToast: (msg: string) => void;
}

function getFdRate(tenureMonths: number): number {
  if (tenureMonths < 12) return 6.5;
  if (tenureMonths < 24) return 7.25;
  if (tenureMonths < 36) return 7.75;
  return 8.25;
}

export const FixedDepositView: React.FC<FixedDepositViewProps> = ({
  token,
  accounts,
  fixedDeposits,
  onRefreshData,
  onToast,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || "");
  const [amountRupees, setAmountRupees] = useState(50000);
  const [tenureMonths, setTenureMonths] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [liquidatingId, setLiquidatingId] = useState<string | null>(null);

  // Preview calculations
  const [interestRate, setInterestRate] = useState(7.25);
  const [maturityAmount, setMaturityAmount] = useState(0);
  const [interestEarned, setInterestEarned] = useState(0);

  useEffect(() => {
    const rate = getFdRate(tenureMonths);
    setInterestRate(rate);

    const years = tenureMonths / 12;
    // Quarterly compounding: A = P * (1 + r / 400)^(4 * years)
    const maturity = amountRupees * Math.pow(1 + rate / 400, 4 * years);
    setMaturityAmount(Math.round(maturity));
    setInterestEarned(Math.round(maturity - amountRupees));
  }, [amountRupees, tenureMonths]);

  const activeAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  const balance = activeAccount ? activeAccount.balancePaise / 100 : 0;

  const handleOpenFd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (amountRupees > balance) {
      setError(`Insufficient account balance. Available: ₹${balance.toLocaleString()}`);
      return;
    }

    setLoading(true);
    try {
      await api.openFd(token, {
        accountId: selectedAccountId,
        amountRupees,
        tenureMonths,
      });

      onToast(`Fixed Deposit of ₹${amountRupees.toLocaleString()} opened successfully!`);
      await onRefreshData();
    } catch (err: any) {
      setError(err.message || "Failed to open Fixed Deposit.");
    } finally {
      setLoading(false);
    }
  };

  const handleLiquidate = async (fd: FixedDeposit) => {
    if (!window.confirm(`Are you sure you want to close FD certificate ${fd.depositNumber}? Funds will be credited immediately to your bank account.`)) {
      return;
    }

    setLiquidatingId(fd.id);
    try {
      const res = await api.liquidateFd(token, fd.id);
      onToast(res.message || "Fixed Deposit closed successfully.");
      await onRefreshData();
    } catch (err: any) {
      onToast(err.message || "Failed to liquidate FD.");
    } finally {
      setLiquidatingId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fixed & Term Deposits</h1>
          <p className="page-subtitle">Guaranteed high-yield returns with quarterly compounding interest</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24, marginBottom: 28 }}>
        {/* Open FD Form */}
        <div className="card-panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <Award size={20} className="text-emerald" />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-main)" }}>Open a New Term Deposit</h2>
          </div>

          {error && (
            <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--rose)", padding: 12, borderRadius: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleOpenFd}>
            <div className="form-group">
              <label className="form-label">Funding Account</label>
              <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountNumber} ({acc.accountType.toUpperCase()} — Balance: ₹{(acc.balancePaise / 100).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Deposit Amount (₹)</label>
              <input
                type="number"
                min="5000"
                step="1000"
                value={amountRupees}
                onChange={(e) => setAmountRupees(Number(e.target.value))}
                required
              />
              <span className="form-hint">Minimum deposit is ₹5,000. Up to ₹50,00,000.</span>
            </div>

            <div className="form-group">
              <label className="form-label">Select Tenure</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 4 }}>
                {[
                  { m: 6, label: "6 Months", rate: "6.50%" },
                  { m: 12, label: "1 Year", rate: "7.25%" },
                  { m: 24, label: "2 Years", rate: "7.75%" },
                  { m: 36, label: "3+ Years", rate: "8.25%" },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.m}
                    style={{
                      background: tenureMonths === item.m ? "rgba(16, 185, 129, 0.15)" : "var(--bg-input)",
                      border: tenureMonths === item.m ? "1px solid var(--emerald)" : "1px solid var(--border-subtle)",
                      borderRadius: 10,
                      padding: "12px 8px",
                      textAlign: "center",
                      color: tenureMonths === item.m ? "var(--emerald)" : "var(--text-main)",
                    }}
                    onClick={() => setTenureMonths(item.m)}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.rate}</div>
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} disabled={loading}>
              <TrendingUp size={16} /> {loading ? "Creating Deposit..." : `Lock In ₹${amountRupees.toLocaleString()} @ ${interestRate}%`}
            </button>
          </form>
        </div>

        {/* Maturity Projection Panel */}
        <div>
          <div className="card-panel" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", marginBottom: 16 }}>
                Projected Maturity Value
              </h3>

              <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 12, padding: 22, textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "var(--emerald)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Guaranteed Maturity Payout
                </div>
                <div style={{ fontSize: 38, fontWeight: 800, color: "var(--text-main)", marginTop: 6 }}>
                  ₹{maturityAmount.toLocaleString()}
                </div>
                <div style={{ fontSize: 12, color: "var(--emerald)", marginTop: 4, fontWeight: 600 }}>
                  +₹{interestEarned.toLocaleString()} Total Interest Accrued
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Principal Deposited</span>
                  <span style={{ fontWeight: 600 }}>₹{amountRupees.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Interest Rate (p.a.)</span>
                  <span style={{ fontWeight: 600, color: "var(--emerald)" }}>{interestRate}% Quarterly Compounded</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Maturity Date</span>
                  <span style={{ fontWeight: 600 }}>
                    {new Date(Date.now() + tenureMonths * 30.5 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--emerald)", fontSize: 12, marginTop: 20 }}>
              <ShieldCheck size={16} /> Covered under Deposit Insurance & Credit Guarantee
            </div>
          </div>
        </div>
      </div>

      {/* Active Fixed Deposits List */}
      <div className="card-panel">
        <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-main)", marginBottom: 18 }}>
          My Fixed Deposits ({fixedDeposits.length})
        </h3>

        {fixedDeposits.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 0", color: "var(--text-muted)" }}>
            No active term deposits found. Open a deposit above to grow your wealth with guaranteed yields.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}>
            {fixedDeposits.map((fd) => {
              const startDate = new Date(fd.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
              const maturityDate = new Date(fd.maturityDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
              return (
                <div
                  key={fd.id}
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 14,
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span className="text-mono" style={{ fontWeight: 700, fontSize: 13, color: "var(--sapphire)" }}>
                        {fd.depositNumber}
                      </span>
                      <span className={`status-pill ${fd.status}`}>
                        {fd.status}
                      </span>
                    </div>

                    <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-main)", marginBottom: 4 }}>
                      ₹{fd.amount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--emerald)", fontWeight: 600 }}>
                      Maturity: ₹{fd.maturityAmount.toLocaleString()} ({fd.interestRate}% for {fd.tenureMonths}m)
                    </div>

                    <div style={{ marginTop: 14, borderTop: "1px solid var(--border-subtle)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Start Date:</span>
                        <span>{startDate}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Maturity Date:</span>
                        <span style={{ fontWeight: 600, color: "var(--text-main)" }}>{maturityDate}</span>
                      </div>
                    </div>
                  </div>

                  {fd.status === "active" && (
                    <button
                      className="btn btn-sm btn-danger"
                      style={{ marginTop: 16 }}
                      onClick={() => handleLiquidate(fd)}
                      disabled={liquidatingId === fd.id}
                    >
                      <ArrowDownRight size={14} /> {liquidatingId === fd.id ? "Liquidating..." : "Premature Liquidation"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
