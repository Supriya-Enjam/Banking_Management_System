
import React, { useEffect, useState } from "react";
import {
  Plus,
  Copy,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";

import {
  api,
  type BankAccount,
  type AccountOpeningApplication,
  type AccountOpeningDocumentType,
} from "../services/api";

interface AccountsViewProps {
  token: string;
  accounts: BankAccount[];
  onRefreshData: () => Promise<void>;
  onOpenDeposit: (accountId: string) => void;
  onOpenWithdraw: (accountId: string) => void;
  onOpenTransfer: (accountId: string) => void;
  onToast: (msg: string) => void;
}

const DOCUMENT_FIELDS: Array<{
  type: AccountOpeningDocumentType;
  label: string;
}> = [
  { type: "identity", label: "Identity proof" },
  { type: "address", label: "Address proof" },
  { type: "photo", label: "Photograph" },
  { type: "business_registration", label: "Business registration" },
];

const formatRupees = (paise: number) =>
  (paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  });

const statusColor: Record<string, string> = {
  pending: "#d97706",
  approved: "#059669",
  rejected: "#dc2626",
};

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
  const [accountType, setAccountType] = useState<
    "savings" | "current" | "business"
  >("savings");
  const [initialDeposit, setInitialDeposit] = useState(1000);
  const [files, setFiles] = useState<
    Partial<Record<AccountOpeningDocumentType, File>>
  >({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [applications, setApplications] = useState<
    AccountOpeningApplication[]
  >([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [applicationLoadError, setApplicationLoadError] = useState("");

  const requiredDocuments = DOCUMENT_FIELDS.filter(
    (document) =>
      document.type !== "business_registration" ||
      accountType === "business"
  );

  const loadApplications = async () => {
    setLoadingApplications(true);
    setApplicationLoadError("");

    try {
      const result = await api.getAccountOpeningApplications(token);
      setApplications(result.applications ?? []);
    } catch (err) {
      setApplicationLoadError(
        err instanceof Error
          ? err.message
          : "Could not load your applications."
      );
    } finally {
      setLoadingApplications(false);
    }
  };

  useEffect(() => {
    void loadApplications();
    // Reload when the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCopy = async (accountNumber: string) => {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopiedId(accountNumber);
      onToast(`Account ${accountNumber} copied to clipboard!`);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      onToast("Could not copy the account number.");
    }
  };

  const handleFileChange = (
    documentType: AccountOpeningDocumentType,
    file: File | undefined
  ) => {
    setFiles((previous) => {
      const next = { ...previous };

      if (file) {
        next[documentType] = file;
      } else {
        delete next[documentType];
      }

      return next;
    });
  };

  const handleCreateAccount = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setError("");

    if (
      !Number.isFinite(initialDeposit) ||
      initialDeposit < 0 ||
      initialDeposit > 100000
    ) {
      setError("The initial deposit must be between ₹0 and ₹1,00,000.");
      return;
    }

    const missingDocuments = requiredDocuments.filter(
      (document) => !files[document.type]
    );

    if (missingDocuments.length > 0) {
      setError(
        `Please upload: ${missingDocuments
          .map((document) => document.label)
          .join(", ")}.`
      );
      return;
    }

    const selectedDocuments = requiredDocuments.map((document) => ({
      documentType: document.type,
      file: files[document.type] as File,
    }));

    const oversizedFile = selectedDocuments.find(
      ({ file }) => file.size > 5 * 1024 * 1024
    );

    if (oversizedFile) {
      setError("Each document must be 5 MB or smaller.");
      return;
    }

    const invalidFile = selectedDocuments.find(
      ({ file }) =>
        !["application/pdf", "image/jpeg", "image/png"].includes(file.type)
    );

    if (invalidFile) {
      setError("Documents must be PDF, JPG/JPEG, or PNG files.");
      return;
    }

    setCreating(true);

    try {
      const result = await api.submitAccountOpeningApplication(token, {
        accountType,
        initialDeposit,
        documents: selectedDocuments,
      });

      onToast(
        result.message || "Application submitted for staff review."
      );

      setShowCreateModal(false);
      setFiles({});
      setInitialDeposit(1000);
      setAccountType("savings");

      await loadApplications();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit your account-opening application."
      );
    } finally {
      setCreating(false);
    }
  };

  const totalBalance = accounts.reduce(
    (sum, account) => sum + account.balancePaise / 100,
    0
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bank Accounts Portfolio</h1>
          <p className="page-subtitle">
            Manage your accounts and track new account applications.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setError("");
            setShowCreateModal(true);
          }}
        >
          <Plus size={16} /> Apply for an Account
        </button>
      </div>

      {/* Portfolio overview */}
      <div
        style={{
          background: "linear-gradient(135deg, #10214a, #0b1428)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          padding: "24px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Total Combined Portfolio Balance
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: "#fff",
              marginTop: 4,
            }}
          >
            {formatRupees(Math.round(totalBalance * 100))}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Accounts
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--emerald)",
            }}
          >
            {accounts.length} Accounts
          </div>
        </div>
      </div>

      {/* Existing accounts */}
      <div className="accounts-grid">
        {accounts.map((account) => {
          const balance = account.balancePaise / 100;
          const dailyLimit =
            (account.dailyLimitPaise || 5000000) / 100;

          return (
            <div key={account.id} className="account-card">
              <div>
                <div className="account-card-top">
                  <span
                    className={`account-type-tag ${account.accountType}`}
                  >
                    {account.accountType}
                  </span>
                  <span className={`status-pill ${account.status}`}>
                    {account.status}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div className="account-number">
                    {account.accountNumber}
                  </div>
                  <button
                    style={{ color: "var(--text-faint)", padding: 4 }}
                    onClick={() => void handleCopy(account.accountNumber)}
                    title="Copy account number"
                  >
                    {copiedId === account.accountNumber ? (
                      <Check size={14} color="#10b981" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>

                <div className="account-balance">
                  {formatRupees(Math.round(balance * 100))}
                </div>

                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-faint)",
                    marginBottom: 12,
                  }}
                >
                  Daily Transfer Limit:{" "}
                  {formatRupees(Math.round(dailyLimit * 100))}
                </div>
              </div>

              <div className="account-card-actions">
                <button
                  className="btn btn-sm btn-secondary"
                  style={{ flex: 1 }}
                  disabled={account.status !== "active"}
                  onClick={() => onOpenDeposit(account.id)}
                >
                  <ArrowDownLeft size={13} /> Deposit
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  style={{ flex: 1 }}
                  disabled={account.status !== "active"}
                  onClick={() => onOpenWithdraw(account.id)}
                >
                  <ArrowUpRight size={13} /> Withdraw
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  style={{ flex: 1 }}
                  disabled={account.status !== "active"}
                  onClick={() => onOpenTransfer(account.id)}
                >
                  <ArrowLeftRight size={13} /> Send
                </button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          className="account-card"
          style={{
            borderStyle: "dashed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            minHeight: 200,
            cursor: "pointer",
            background: "transparent",
            color: "inherit",
          }}
          onClick={() => {
            setError("");
            setShowCreateModal(true);
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--emerald)",
              }}
            >
              <Plus size={22} />
            </div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: "var(--text-main)",
              }}
            >
              Apply for Another Account
            </div>
            <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
              Approval required before activation
            </div>
          </div>
        </button>
      </div>

      {/* Account-opening application status */}
      <section style={{ marginTop: 32 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>
              Account-opening applications
            </h2>
            <p
              style={{
                margin: "6px 0 0",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              Track your submitted applications and staff decisions.
            </p>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => void loadApplications()}
            disabled={loadingApplications}
          >
            Refresh status
          </button>
        </div>

        {loadingApplications ? (
          <p>Loading your applications...</p>
        ) : applicationLoadError ? (
          <div role="alert" style={{ color: "#dc2626" }}>
            {applicationLoadError}
          </div>
        ) : applications.length === 0 ? (
          <div
            style={{
              padding: 24,
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              color: "var(--text-muted)",
            }}
          >
            You have not submitted any account-opening applications yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {applications.map((application) => {
              const rejected = application.status === "rejected";
              const approved = application.status === "approved";

              return (
                <article
                  key={application.id}
                  style={{
                    padding: 18,
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 12,
                    background: "var(--bg-card, transparent)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          textTransform: "capitalize",
                        }}
                      >
                        {application.accountType} account
                      </div>
                      <div
                        style={{
                          marginTop: 5,
                          fontSize: 12,
                          color: "var(--text-muted)",
                        }}
                      >
                        Submitted{" "}
                        {new Date(application.createdAt).toLocaleDateString(
                          "en-IN"
                        )}
                      </div>
                    </div>

                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        color: statusColor[application.status],
                        fontWeight: 700,
                        fontSize: 13,
                        textTransform: "capitalize",
                      }}
                    >
                      {application.status === "pending" ? (
                        <Clock size={16} />
                      ) : approved ? (
                        <CheckCircle size={16} />
                      ) : (
                        <XCircle size={16} />
                      )}
                      {application.status}
                    </span>
                  </div>

                  <div style={{ marginTop: 12, fontSize: 13 }}>
                    Initial deposit:{" "}
                    <strong>
                      {formatRupees(application.initialDepositPaise)}
                    </strong>
                  </div>

                  {application.accountId && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 13,
                        color: "#059669",
                      }}
                    >
                      Your account has been created. Refresh your account
                      portfolio if it is not visible yet.
                    </div>
                  )}

                  {rejected && application.reviewRemarks && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 8,
                        background: "rgba(220, 38, 38, 0.08)",
                        color: "#dc2626",
                        fontSize: 13,
                      }}
                    >
                      <strong>Review remarks:</strong>{" "}
                      {application.reviewRemarks}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* New account application modal */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!creating) setShowCreateModal(false);
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-opening-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <span id="account-opening-title" className="modal-title">
                Apply for a Bank Account
              </span>
              <button
                type="button"
                className="icon-btn"
                disabled={creating}
                onClick={() => setShowCreateModal(false)}
                aria-label="Close application form"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAccount}>
              <div
                className="modal-body"
                style={{ maxHeight: "70vh", overflowY: "auto" }}
              >
                {error && (
                  <div
                    role="alert"
                    style={{
                      background: "rgba(239, 68, 68, 0.1)",
                      color: "var(--rose)",
                      padding: 12,
                      borderRadius: 8,
                      fontSize: 13,
                      marginBottom: 14,
                    }}
                  >
                    {error}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="opening-account-type">
                    Account type
                  </label>
                  <select
                    id="opening-account-type"
                    value={accountType}
                    disabled={creating}
                    onChange={(event) =>
                      setAccountType(
                        event.target.value as
                          | "savings"
                          | "current"
                          | "business"
                      )
                    }
                  >
                    <option value="savings">Savings account</option>
                    <option value="current">Current account</option>
                    <option value="business">Business account</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="opening-deposit">
                    Initial opening deposit (₹)
                  </label>
                  <input
                    id="opening-deposit"
                    type="number"
                    min="0"
                    max="100000"
                    step="0.01"
                    required
                    value={initialDeposit}
                    disabled={creating}
                    onChange={(event) =>
                      setInitialDeposit(Number(event.target.value))
                    }
                  />
                  <span className="form-hint">
                    Enter an amount from ₹0 to ₹1,00,000.
                  </span>
                </div>

                <div style={{ marginTop: 20, marginBottom: 12 }}>
                  <h3 style={{ fontSize: 15, margin: "0 0 6px" }}>
                    Required documents
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      color: "var(--text-muted)",
                      fontSize: 12,
                    }}
                  >
                    PDF, JPG, JPEG, or PNG. Maximum 5 MB per file.
                  </p>
                </div>

                {requiredDocuments.map((document) => (
                  <div
                    className="form-group"
                    key={document.type}
                    style={{ marginBottom: 16 }}
                  >
                    <label
                      className="form-label"
                      htmlFor={`document-${document.type}`}
                    >
                      {document.label}
                    </label>

                    <input
                      id={`document-${document.type}`}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      required
                      disabled={creating}
                      onChange={(event) =>
                        handleFileChange(
                          document.type,
                          event.target.files?.[0]
                        )
                      }
                    />

                    {files[document.type] && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          color: "var(--text-muted)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <FileText size={14} />
                        <span>{files[document.type]?.name}</span>
                      </div>
                    )}
                  </div>
                ))}

                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: "rgba(16, 185, 129, 0.08)",
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                >
                  Your application will remain pending until bank staff
                  reviews your documents. An account is created only after
                  approval.
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={creating}
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? "Submitting..." : "Submit for Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
