import React from "react";
import { X, Printer, CheckCircle, Landmark, ShieldCheck } from "lucide-react";

interface ReceiptModalProps {
  receipt: any;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receipt, onClose }) => {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(receipt.date || receipt.createdAt || Date.now()).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const amount = Number(receipt.amount || (receipt.amountPaise ? receipt.amountPaise / 100 : 0));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card printable-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header no-print">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={18} className="text-emerald" />
            <span className="modal-title">Official Transaction Receipt</span>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="receipt-paper">
            <div className="receipt-header">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 }}>
                <Landmark size={24} color="#0f172a" />
                <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", letterSpacing: -0.5 }}>VAULTBANK</h3>
              </div>
              <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
                Digital Core Banking System
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, color: "#10b981", fontWeight: 700, fontSize: 14 }}>
                <CheckCircle size={16} /> Transaction Completed
              </div>
            </div>

            <div style={{ textAlign: "center", margin: "20px 0" }}>
              <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Amount Transacted
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{ borderTop: "1px dashed #cbd5e1", borderBottom: "1px dashed #cbd5e1", padding: "16px 0", margin: "16px 0" }}>
              <div className="receipt-row">
                <span style={{ color: "#64748b" }}>Reference Number</span>
                <span className="text-mono" style={{ fontWeight: 600 }}>{receipt.reference}</span>
              </div>
              <div className="receipt-row">
                <span style={{ color: "#64748b" }}>Date & Time</span>
                <span>{formattedDate}</span>
              </div>
              <div className="receipt-row">
                <span style={{ color: "#64748b" }}>Payment Type</span>
                <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{receipt.type}</span>
              </div>
              <div className="receipt-row">
                <span style={{ color: "#64748b" }}>Category</span>
                <span>{receipt.category || "General Banking"}</span>
              </div>
              {receipt.sender?.accountNumber && (
                <div className="receipt-row">
                  <span style={{ color: "#64748b" }}>Sender Account</span>
                  <span className="text-mono">{receipt.sender.accountNumber}</span>
                </div>
              )}
              {receipt.recipient?.accountNumber && receipt.recipient.accountNumber !== "—" && (
                <div className="receipt-row">
                  <span style={{ color: "#64748b" }}>Recipient Details</span>
                  <span>{receipt.recipient.name} ({receipt.recipient.accountNumber})</span>
                </div>
              )}
              <div className="receipt-row">
                <span style={{ color: "#64748b" }}>Description</span>
                <span>{receipt.description || "Electronic Fund Transfer"}</span>
              </div>
              <div className="receipt-row">
                <span style={{ color: "#64748b" }}>Transfer Fee</span>
                <span style={{ color: "#10b981", fontWeight: 600 }}>₹0.00 (Free)</span>
              </div>
            </div>

            <div style={{ textAlign: "center", marginTop: 16 }}>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                This is a computer-generated bank receipt verified by VaultBank Security Vault.
              </div>
              <div className="text-mono" style={{ fontSize: 10, color: "#cbd5e1", marginTop: 6 }}>
                AUTH_HASH: {btoa(receipt.reference || "VB").slice(0, 24)}...
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer no-print">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
};
