import React, { useState, useEffect } from "react";
import { ArrowRight, Send, UserPlus, CheckCircle, AlertCircle, Shield, Trash2, Search, UserCheck, X } from "lucide-react";
import { api, type BankAccount, type Beneficiary } from "../services/api";

interface TransferViewProps {
  token: string;
  accounts: BankAccount[];
  beneficiaries: Beneficiary[];
  onRefreshData: () => Promise<void>;
  onShowReceipt: (receipt: any) => void;
  onToast: (msg: string) => void;
}

export const TransferView: React.FC<TransferViewProps> = ({
  token,
  accounts,
  beneficiaries,
  onRefreshData,
  onShowReceipt,
  onToast,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || "");
  const [recipientAccountNum, setRecipientAccountNum] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Transfer");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Payee lookup feedback
  const [lookupName, setLookupName] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  // Add Beneficiary Modal
  const [showAddPayee, setShowAddPayee] = useState(false);
  const [payeeName, setPayeeName] = useState("");
  const [payeeAcc, setPayeeAcc] = useState("");
  const [payeeBank, setPayeeBank] = useState("VaultBank");
  const [payeeIfsc, setPayeeIfsc] = useState("VAULT000108");
  const [payeeNick, setPayeeNick] = useState("");
  const [addPayeeLoading, setAddPayeeLoading] = useState(false);
  const [addPayeeError, setAddPayeeError] = useState("");

  const activeAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  const balance = activeAccount ? activeAccount.balancePaise / 100 : 0;
  const dailyLimit = activeAccount ? activeAccount.dailyLimitPaise / 100 : 50000;

  // Auto-verify account number if entered
  useEffect(() => {
    if (!recipientAccountNum || recipientAccountNum.trim().length < 5) {
      setLookupName("");
      return;
    }

    const timer = setTimeout(async () => {
      setLookupLoading(true);
      try {
        const res = await api.lookupAccount(token, recipientAccountNum.trim());
        if (res.found && res.customerName) {
          setLookupName(res.customerName);
        } else {
          setLookupName("");
        }
      } catch {
        setLookupName("");
      } finally {
        setLookupLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [recipientAccountNum, token]);

  const handleSelectBeneficiary = (b: Beneficiary) => {
    setRecipientAccountNum(b.accountNumber);
    setLookupName(b.name);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid amount greater than ₹0.");
      return;
    }

    if (numAmount > balance) {
      setError(`Insufficient account balance. Available: ₹${balance.toLocaleString()}`);
      return;
    }

    if (!recipientAccountNum.trim()) {
      setError("Please specify the recipient account number.");
      return;
    }

    if (activeAccount?.accountNumber === recipientAccountNum.trim()) {
      setError("Cannot transfer funds to the identical source account.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.transfer(token, {
        accountId: activeAccount.id,
        recipientAccountNumber: recipientAccountNum.trim(),
        amount: numAmount,
        category,
        description: description.trim() || `Transfer to ${recipientAccountNum.trim()}`,
      });

      onToast(`₹${numAmount.toLocaleString()} transferred successfully!`);
      setAmount("");
      setDescription("");
      setRecipientAccountNum("");
      setLookupName("");
      await onRefreshData();

      // Show receipt
      if (res.transaction?.reference) {
        const receiptRes = await api.getReceipt(token, res.transaction.reference);
        if (receiptRes.receipt) {
          onShowReceipt(receiptRes.receipt);
        }
      }
    } catch (err: any) {
      setError(err.message || "Transfer failed. Please check details.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddPayeeError("");
    setAddPayeeLoading(true);

    try {
      await api.addBeneficiary(token, {
        name: payeeName.trim(),
        accountNumber: payeeAcc.trim(),
        bankName: payeeBank.trim(),
        ifscCode: payeeIfsc.trim(),
        nickname: payeeNick.trim() || payeeName.trim(),
      });

      onToast(`Beneficiary ${payeeName} added successfully!`);
      setShowAddPayee(false);
      setPayeeName("");
      setPayeeAcc("");
      setPayeeNick("");
      await onRefreshData();
    } catch (err: any) {
      setAddPayeeError(err.message || "Failed to add beneficiary.");
    } finally {
      setAddPayeeLoading(false);
    }
  };

  const handleDeleteBeneficiary = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from your beneficiaries?`)) return;
    try {
      await api.deleteBeneficiary(token, id);
      onToast(`Beneficiary ${name} removed.`);
      await onRefreshData();
    } catch (err: any) {
      onToast(err.message || "Could not delete beneficiary.");
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Instant Fund Transfer</h1>
          <p className="page-subtitle">Send money securely to VaultBank accounts and external banks 24/7</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowAddPayee(true)}>
          <UserPlus size={16} /> Add New Payee
        </button>
      </div>

      {/* Saved Beneficiaries Quick Row */}
      <div className="card-panel" style={{ padding: "18px 22px", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Frequent Payees ({beneficiaries.length})
          </div>
          <button className="btn btn-sm btn-secondary" onClick={() => setShowAddPayee(true)}>
            + New
          </button>
        </div>

        {beneficiaries.length === 0 ? (
          <div style={{ color: "var(--text-faint)", fontSize: 13, padding: "8px 0" }}>
            No saved beneficiaries yet. Click "Add New Payee" to save accounts for 1-click transfers.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
            {beneficiaries.map((b) => (
              <div
                key={b.id}
                style={{
                  background: recipientAccountNum === b.accountNumber ? "rgba(16, 185, 129, 0.1)" : "var(--bg-input)",
                  border: recipientAccountNum === b.accountNumber ? "1px solid var(--emerald)" : "1px solid var(--border-subtle)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease",
                }}
                onClick={() => handleSelectBeneficiary(b)}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-main)" }}>{b.name}</div>
                  <div className="text-mono" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                    {b.accountNumber}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--sapphire)", marginTop: 2 }}>{b.bankName}</div>
                </div>
                <button
                  style={{ color: "var(--text-faint)", padding: 4 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteBeneficiary(b.id, b.name);
                  }}
                  title="Remove Beneficiary"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Transfer Form & Limits Panel */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24 }}>
        {/* Transfer Form */}
        <div className="card-panel">
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18, color: "var(--text-main)" }}>
            Transfer Details
          </h2>

          {error && (
            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "12px 16px", borderRadius: 8, color: "var(--rose)", fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleTransfer}>
            <div className="form-group">
              <label className="form-label">Debiting Account</label>
              <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountNumber} — {a.accountType.toUpperCase()} (Available: ₹{(a.balancePaise / 100).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Recipient Account Number</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="e.g. VB1002003001 or beneficiary account"
                  value={recipientAccountNum}
                  onChange={(e) => setRecipientAccountNum(e.target.value)}
                  required
                />
                {lookupLoading && (
                  <span style={{ position: "absolute", right: 12, top: 12, fontSize: 11, color: "var(--sapphire)" }}>
                    Verifying...
                  </span>
                )}
              </div>
              {lookupName && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--emerald)", marginTop: 6, fontWeight: 600 }}>
                  <UserCheck size={14} /> Verified Holder: {lookupName}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Transfer Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Transfer Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="Transfer">Direct Transfer</option>
                  <option value="Bill Payment">Bill Payment</option>
                  <option value="Family & Friends">Family & Friends</option>
                  <option value="Business Payment">Business Invoice</option>
                  <option value="Investment">Investment / Savings</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Description / Remarks</label>
              <input
                type="text"
                placeholder="e.g. Project retainer, rent, gift..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 10 }} disabled={loading}>
              <Send size={16} /> {loading ? "Authorizing Transfer..." : "Confirm & Send Funds"}
            </button>
          </form>
        </div>

        {/* Security & Limits Sidebar */}
        <div>
          <div className="card-panel">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--text-main)" }}>
              Account Limit & Protection
            </h3>

            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                <span>Daily Limit Allowance</span>
                <span className="text-mono" style={{ color: "var(--text-main)", fontWeight: 600 }}>₹{dailyLimit.toLocaleString()}</span>
              </div>
              <div className="daily-limit-bar">
                <div className="daily-limit-fill" style={{ width: "35%" }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>
                Resets daily at 00:00 midnight IST.
              </div>
            </div>

            <div style={{ background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--emerald)", fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                <Shield size={16} /> End-to-End Encryption
              </div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Every fund transfer is cryptographically signed and settled instantaneously on the VaultBank high-frequency ledger. Zero processing fees.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Beneficiary Modal */}
      {showAddPayee && (
        <div className="modal-overlay" onClick={() => setShowAddPayee(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add Frequent Payee</span>
              <button className="icon-btn" onClick={() => setShowAddPayee(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddBeneficiary}>
              <div className="modal-body">
                {addPayeeError && (
                  <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--rose)", padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                    {addPayeeError}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Payee Full Legal Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={payeeName}
                    onChange={(e) => setPayeeName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Number</label>
                  <input
                    type="text"
                    placeholder="e.g. VB2004006001 or bank account"
                    value={payeeAcc}
                    onChange={(e) => setPayeeAcc(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. VaultBank, HDFC"
                      value={payeeBank}
                      onChange={(e) => setPayeeBank(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">IFSC / Routing Code</label>
                    <input
                      type="text"
                      placeholder="e.g. VAULT000108"
                      value={payeeIfsc}
                      onChange={(e) => setPayeeIfsc(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Nickname (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Landlord, Sarah Office"
                    value={payeeNick}
                    onChange={(e) => setPayeeNick(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddPayee(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={addPayeeLoading}>
                  {addPayeeLoading ? "Saving..." : "Save Payee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
