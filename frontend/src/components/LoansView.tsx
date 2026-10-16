import React, { useState, useEffect } from "react";
import { Landmark, CheckCircle, Clock, AlertCircle, Calculator, FileCheck, CreditCard, ChevronRight } from "lucide-react";
import { api, type BankAccount, type Loan } from "../services/api";

interface LoansViewProps {
  token: string;
  accounts: BankAccount[];
  loans: Loan[];
  onRefreshData: () => Promise<void>;
  onToast: (msg: string) => void;
}

const loanRates: Record<string, number> = {
  Personal: 10.5,
  Home: 8.4,
  Vehicle: 9.0,
  Education: 7.5,
  Business: 11.5,
};

export const LoansView: React.FC<LoansViewProps> = ({
  token,
  accounts,
  loans,
  onRefreshData,
  onToast,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || "");
  const [loanType, setLoanType] = useState<"Personal" | "Home" | "Vehicle" | "Education" | "Business">("Personal");
  const [amountRupees, setAmountRupees] = useState(250000);
  const [tenureMonths, setTenureMonths] = useState(24);
  const [purpose, setPurpose] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");

  // EMI Preview state
  const [previewEmi, setPreviewEmi] = useState(0);
  const [previewTotalInterest, setPreviewTotalInterest] = useState(0);
  const [previewTotalRepayment, setPreviewTotalRepayment] = useState(0);

  // EMI Payment loading
  const [payingEmiId, setPayingEmiId] = useState<string | null>(null);

  // Recalculate EMI whenever amount, tenure, or loan type changes
  useEffect(() => {
    const rate = loanRates[loanType] || 10.0;
    const monthlyRate = rate / 12 / 100;
    const factor = Math.pow(1 + monthlyRate, tenureMonths);
    const emi = (amountRupees * monthlyRate * factor) / (factor - 1);
    const totalRepay = emi * tenureMonths;

    setPreviewEmi(Math.round(emi));
    setPreviewTotalInterest(Math.round(totalRepay - amountRupees));
    setPreviewTotalRepayment(Math.round(totalRepay));
  }, [amountRupees, tenureMonths, loanType]);

  const handleApplyLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyError("");

    if (!selectedAccountId) {
      setApplyError("Please select an active disbursement account.");
      return;
    }

    if (!purpose.trim()) {
      setApplyError("Please enter the primary purpose of the loan.");
      return;
    }

    setApplying(true);
    try {
      await api.applyLoan(token, {
        accountId: selectedAccountId,
        loanType,
        amountRupees,
        tenureMonths,
        purpose: purpose.trim(),
      });

      onToast(`Loan application for ₹${amountRupees.toLocaleString()} submitted!`);
      setPurpose("");
      await onRefreshData();
    } catch (err: any) {
      setApplyError(err.message || "Failed to submit loan application.");
    } finally {
      setApplying(false);
    }
  };

  const handlePayEmi = async (loanId: string, emiAmount: number) => {
    if (!window.confirm(`Pay monthly EMI of ₹${emiAmount.toLocaleString()} directly from linked bank account?`)) return;

    setPayingEmiId(loanId);
    try {
      await api.payLoanEmi(token, loanId);
      onToast(`Monthly EMI of ₹${emiAmount.toLocaleString()} paid successfully!`);
      await onRefreshData();
    } catch (err: any) {
      onToast(err.message || "EMI payment failed.");
    } finally {
      setPayingEmiId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Loan & Credit Facilities</h1>
          <p className="page-subtitle">Low-interest financing with instant approval criteria and clear repayment schedules</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24, marginBottom: 28 }}>
        {/* Application & EMI Calculator */}
        <div className="card-panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <Calculator size={20} className="text-sapphire" />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-main)" }}>Loan Application & Live Calculator</h2>
          </div>

          {applyError && (
            <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--rose)", padding: 12, borderRadius: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <AlertCircle size={16} /> {applyError}
            </div>
          )}

          <form onSubmit={handleApplyLoan}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Loan Product</label>
                <select value={loanType} onChange={(e) => setLoanType(e.target.value as any)}>
                  <option value="Personal">Personal Loan ({loanRates.Personal}% p.a.)</option>
                  <option value="Home">Home Loan ({loanRates.Home}% p.a.)</option>
                  <option value="Vehicle">Vehicle Loan ({loanRates.Vehicle}% p.a.)</option>
                  <option value="Education">Education Loan ({loanRates.Education}% p.a.)</option>
                  <option value="Business">Business Loan ({loanRates.Business}% p.a.)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Disbursement Account</label>
                <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountNumber} ({acc.accountType.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount Slider */}
            <div className="form-group" style={{ margin: "16px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="form-label">Requested Loan Amount</label>
                <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)" }}>
                  ₹{amountRupees.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="25000"
                max="5000000"
                step="25000"
                value={amountRupees}
                onChange={(e) => setAmountRupees(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--emerald)", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-faint)" }}>
                <span>Min ₹25,000</span>
                <span>Max ₹50,00,000</span>
              </div>
            </div>

            {/* Tenure Slider */}
            <div className="form-group" style={{ margin: "16px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="form-label">Repayment Tenure</label>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
                  {tenureMonths} Months ({Math.round(tenureMonths / 12 * 10) / 10} Years)
                </span>
              </div>
              <input
                type="range"
                min="6"
                max="120"
                step="6"
                value={tenureMonths}
                onChange={(e) => setTenureMonths(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--sapphire)", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-faint)" }}>
                <span>6 Months</span>
                <span>120 Months</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Purpose of Loan</label>
              <input
                type="text"
                placeholder="e.g. Home purchase, vehicle upgrade, higher education..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 10 }} disabled={applying}>
              <FileCheck size={16} /> {applying ? "Submitting Application..." : "Submit Loan Application"}
            </button>
          </form>
        </div>

        {/* EMI Summary Card */}
        <div>
          <div className="card-panel" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)", marginBottom: 16 }}>
                Repayment Breakdown
              </h3>

              <div style={{ background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: 12, padding: 20, textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "var(--sapphire)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Estimated Monthly EMI
                </div>
                <div style={{ fontSize: 36, fontWeight: 800, color: "var(--text-main)", marginTop: 6 }}>
                  ₹{previewEmi.toLocaleString()}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
                  Calculated at {loanRates[loanType]}% annual interest rate
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Principal Amount</span>
                  <span style={{ fontWeight: 600 }}>₹{amountRupees.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Total Interest</span>
                  <span style={{ fontWeight: 600, color: "var(--amber)" }}>₹{previewTotalInterest.toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 8 }}>
                  <span style={{ color: "var(--text-muted)" }}>Total Repayment</span>
                  <span style={{ fontWeight: 700, color: "var(--text-main)" }}>₹{previewTotalRepayment.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div style={{ background: "rgba(255, 255, 255, 0.03)", borderRadius: 8, padding: 12, marginTop: 20, fontSize: 11.5, color: "var(--text-faint)" }}>
              ✓ Auto-debit on 5th of each month. No prepayment penalty after 6 months.
            </div>
          </div>
        </div>
      </div>

      {/* Active Loans & Applications */}
      <div className="card-panel">
        <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-main)", marginBottom: 18 }}>
          My Loan Accounts ({loans.length})
        </h3>

        {loans.length === 0 ? (
          <div style={{ textAlign: "center", padding: "36px 0", color: "var(--text-muted)" }}>
            No loan applications found. Use the calculator above to apply for immediate financing.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {loans.map((loan) => {
              const progress = Math.min(100, Math.round((loan.paidEmis / loan.tenureMonths) * 100));
              return (
                <div
                  key={loan.id}
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 12,
                    padding: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 16,
                  }}
                >
                  <div style={{ minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-main)" }}>
                        {loan.loanType} Loan
                      </span>
                      <span className={`status-pill ${loan.status}`}>
                        {loan.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>
                      Purpose: {loan.purpose} | Account: {loan.accountNumber}
                    </div>
                    {loan.reviewNotes && (
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>
                        Bank Note: {loan.reviewNotes}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Principal</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
                      ₹{loan.amount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                      {loan.interestRate}% p.a.
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Monthly EMI</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--emerald)" }}>
                      ₹{loan.emiAmount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                      Remaining: ₹{loan.remainingAmount.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ minWidth: 160 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                      <span>Tenure Progress</span>
                      <span>{loan.paidEmis} / {loan.tenureMonths} EMIs</span>
                    </div>
                    <div className="daily-limit-bar" style={{ height: 6 }}>
                      <div className="daily-limit-fill" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  {loan.status === "approved" && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handlePayEmi(loan.id, loan.emiAmount)}
                      disabled={payingEmiId === loan.id}
                    >
                      <CreditCard size={14} /> {payingEmiId === loan.id ? "Processing..." : "Pay EMI"}
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
