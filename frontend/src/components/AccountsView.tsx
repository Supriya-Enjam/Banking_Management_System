
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
  Upload,
  Trash2,
  FileImage,
} from "lucide-react";

import {
  api,
  type BankAccount,
  type Customer,
  type AccountOpeningApplication,
  type AccountOpeningRequirements,
  type AccountOpeningApplicantDetails,
  type AccountOpeningDocumentType,
} from "../services/api";

interface AccountsViewProps {
  token: string;
  customer: Customer;
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

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

const LocalDocumentPreview: React.FC<{ file: File }> = ({ file }) => {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!previewUrl) return null;

  return file.type === "application/pdf" ? (
    <iframe
      title={`Preview of ${file.name}`}
      src={previewUrl}
      style={{
        display: "block",
        width: "100%",
        height: 260,
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
      }}
    />
  ) : (
    <img
      src={previewUrl}
      alt={`Preview of ${file.name}`}
      style={{
        display: "block",
        maxWidth: "100%",
        maxHeight: 260,
        objectFit: "contain",
        borderRadius: 8,
      }}
    />
  );
};

export const AccountsView: React.FC<AccountsViewProps> = ({
  token,
  customer,
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
  const [applicantDetails, setApplicantDetails] =
    useState<AccountOpeningApplicantDetails>({
      fullName: customer.name || "",
      dateOfBirth: "",
      email: customer.email || "",
      mobileNumber: customer.phone || "",
      residentialAddress: customer.address || "",
    });
  const [files, setFiles] = useState<
    Partial<Record<AccountOpeningDocumentType, File>>
  >({});
  const [uploadRequirements, setUploadRequirements] =
    useState<AccountOpeningRequirements | null>(null);
  const [loadingUploadRequirements, setLoadingUploadRequirements] =
    useState(false);
  const [uploadRequirementsError, setUploadRequirementsError] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [applications, setApplications] = useState<
    AccountOpeningApplication[]
  >([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [applicationLoadError, setApplicationLoadError] = useState("");

  useEffect(() => {
    if (!showCreateModal) return;

    let active = true;
    setLoadingUploadRequirements(true);
    setUploadRequirementsError("");

    void api
      .getAccountOpeningRequirements(token)
      .then((requirements) => {
        if (active) setUploadRequirements(requirements);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setUploadRequirements(null);
        setUploadRequirementsError(
          err instanceof Error
            ? err.message
            : "Could not load document upload requirements."
        );
      })
      .finally(() => {
        if (active) setLoadingUploadRequirements(false);
      });

    return () => {
      active = false;
    };
  }, [showCreateModal, token]);

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
    if (
      uploadRequirements &&
      requiredDocuments.length > uploadRequirements.maxDocumentCount
    ) {
      setError(
        "The selected account type requires more documents than the server currently accepts."
      );
      return;
    }

    if (file && uploadRequirements) {
      if (!uploadRequirements.acceptedMimeTypes.includes(file.type)) {
        setError("Choose a PDF, JPEG, or PNG file.");
        return;
      }

      if (file.size > uploadRequirements.maxDocumentSizeBytes) {
        setError(
          `Each document must be ${formatFileSize(uploadRequirements.maxDocumentSizeBytes)} or smaller.`
        );
        return;
      }
    }

    setError("");
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
      initialDeposit > 100000 ||
      Math.abs(initialDeposit * 100 - Math.round(initialDeposit * 100)) >
        0.000001
    ) {
      setError("The initial deposit must be between ₹0 and ₹1,00,000.");
      return;
    }

    if (!uploadRequirements) {
      setError("Document upload requirements are unavailable. Please retry.");
      return;
    }

    if (requiredDocuments.length > uploadRequirements.maxDocumentCount) {
      setError(
        "The selected account type requires more documents than the server currently accepts."
      );
      return;
    }

    const dateOfBirth = new Date(
      `${applicantDetails.dateOfBirth}T00:00:00`
    );
    if (
      applicantDetails.fullName.trim().length < 2 ||
      applicantDetails.fullName.trim().length > 80 ||
      !applicantDetails.dateOfBirth ||
      Number.isNaN(dateOfBirth.getTime()) ||
      dateOfBirth.getTime() > Date.now() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantDetails.email.trim()) ||
      !/^[+()\d\s.-]{7,30}$/.test(applicantDetails.mobileNumber.trim()) ||
      (applicantDetails.mobileNumber.match(/\d/g)?.length ?? 0) < 7 ||
      (applicantDetails.mobileNumber.match(/\d/g)?.length ?? 0) > 15 ||
      applicantDetails.residentialAddress.trim().length < 5 ||
      applicantDetails.residentialAddress.trim().length > 250
    ) {
      setError("Enter valid applicant details before continuing.");
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
      ({ file }) => file.size > uploadRequirements.maxDocumentSizeBytes
    );

    if (oversizedFile) {
      setError(
        `Each document must be ${formatFileSize(uploadRequirements.maxDocumentSizeBytes)} or smaller.`
      );
      return;
    }

    const invalidFile = selectedDocuments.find(
      ({ file }) =>
        !uploadRequirements.acceptedMimeTypes.includes(file.type)
    );

    if (invalidFile) {
      setError("One or more files use an unsupported format.");
      return;
    }

    if (
      !window.confirm(
        `Submit your ${accountType} account application for ${formatRupees(Math.round(initialDeposit * 100))}? Bank staff will review your details and documents before an account can be opened.`
      )
    ) {
      return;
    }

    setCreating(true);

    try {
      const result = await api.submitAccountOpeningApplication(token, {
        accountType,
        initialDeposit,
        applicantDetails: {
          ...applicantDetails,
          fullName: applicantDetails.fullName.trim(),
          email: applicantDetails.email.trim(),
          mobileNumber: applicantDetails.mobileNumber.trim(),
          residentialAddress:
            applicantDetails.residentialAddress.trim(),
        },
        documents: selectedDocuments,
      });

      onToast(
        result.message || "Application submitted for staff review."
      );

      setShowCreateModal(false);
      setFiles({});
      setInitialDeposit(1000);
      setAccountType("savings");
      setApplicantDetails({
        fullName: customer.name || "",
        dateOfBirth: "",
        email: customer.email || "",
        mobileNumber: customer.phone || "",
        residentialAddress: customer.address || "",
      });

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

{/* Document Analysis Results */}
<div
  style={{
    marginTop: 16,
    paddingTop: 14,
    borderTop: "1px solid var(--border-subtle)",
  }}
>
  <h3
    style={{
      margin: "0 0 12px",
      fontSize: 14,
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}
  >
    <FileText size={16} />
    Document Analysis
  </h3>

  <div style={{ display: "grid", gap: 10 }}>
    {application.documents.map((document) => {
      const config = {
        pending: {
          label: "Analysis Pending",
          color: "#6b7280",
          Icon: Clock,
        },
        readable: {
          label: "Readable",
          color: "#059669",
          Icon: CheckCircle,
        },
        unreadable: {
          label: "Unreadable",
          color: "#dc2626",
          Icon: XCircle,
        },
        manual_review: {
          label: "Manual Review Required",
          color: "#d97706",
          Icon: Clock,
        },
      }[document.verificationStatus];

      return (
        <div
          key={document.id}
          style={{
            padding: 12,
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  textTransform: "capitalize",
                }}
              >
                {document.documentType.replace(/_/g, " ")}
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: "var(--text-muted)",
                  overflowWrap: "anywhere",
                }}
              >
                {document.originalName}
              </div>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                color: config.color,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <config.Icon size={15} />
              {config.label}
            </span>
          </div>

          <p
            style={{
              margin: "8px 0 0",
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--text-muted)",
            }}
          >
            {document.analysisMessage ||
              "No analysis details available."}
          </p>

          <div
            style={{
              marginTop: 10,
              paddingTop: 9,
              borderTop: "1px solid var(--border-subtle)",
              fontSize: 12,
            }}
          >
            <div style={{ fontWeight: 700 }}>
              Authenticity:{" "}
              <span
                style={{
                  color:
                    document.authenticityStatus === "verified"
                      ? "#059669"
                      : document.authenticityStatus === "rejected"
                        ? "#dc2626"
                        : "#d97706",
                  textTransform: "capitalize",
                }}
              >
                {document.authenticityStatus || "pending"}
              </span>
            </div>
            <p
              style={{
                margin: "4px 0 0",
                lineHeight: 1.5,
                color: "var(--text-muted)",
              }}
            >
              {document.authenticityMessage ||
                "Document authenticity has not been verified."}
            </p>
            {document.authenticityVerifiedAt && (
              <div style={{ marginTop: 4, color: "var(--text-muted)" }}>
                Decision recorded{" "}
                {new Date(document.authenticityVerifiedAt).toLocaleString(
                  "en-IN"
                )}
              </div>
            )}
          </div>
        </div>
      );
    })}
  </div>

  <p
    style={{
      margin: "10px 0 0",
      fontSize: 11,
      lineHeight: 1.5,
      color: "var(--text-muted)",
    }}
  >
    This analysis checks document readability, not authenticity.
    Bank staff must still review your documents.
  </p>
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

                <h3 style={{ fontSize: 15, margin: "0 0 12px" }}>
                  Applicant details
                </h3>
                <div className="form-group">
                  <label className="form-label" htmlFor="opening-full-name">
                    Full name
                  </label>
                  <input
                    id="opening-full-name"
                    type="text"
                    autoComplete="name"
                    minLength={2}
                    maxLength={80}
                    required
                    value={applicantDetails.fullName}
                    disabled={creating}
                    onChange={(event) =>
                      setApplicantDetails((previous) => ({
                        ...previous,
                        fullName: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="opening-dob">
                    Date of birth
                  </label>
                  <input
                    id="opening-dob"
                    type="date"
                    autoComplete="bday"
                    max={new Date().toISOString().slice(0, 10)}
                    required
                    value={applicantDetails.dateOfBirth}
                    disabled={creating}
                    onChange={(event) =>
                      setApplicantDetails((previous) => ({
                        ...previous,
                        dateOfBirth: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="opening-email">
                    Email address
                  </label>
                  <input
                    id="opening-email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    required
                    value={applicantDetails.email}
                    disabled={creating}
                    onChange={(event) =>
                      setApplicantDetails((previous) => ({
                        ...previous,
                        email: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="opening-mobile">
                    Mobile number
                  </label>
                  <input
                    id="opening-mobile"
                    type="tel"
                    autoComplete="tel"
                    maxLength={30}
                    required
                    value={applicantDetails.mobileNumber}
                    disabled={creating}
                    onChange={(event) =>
                      setApplicantDetails((previous) => ({
                        ...previous,
                        mobileNumber: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="opening-address">
                    Residential address
                  </label>
                  <textarea
                    id="opening-address"
                    autoComplete="street-address"
                    minLength={5}
                    maxLength={250}
                    rows={3}
                    required
                    value={applicantDetails.residentialAddress}
                    disabled={creating}
                    onChange={(event) =>
                      setApplicantDetails((previous) => ({
                        ...previous,
                        residentialAddress: event.target.value,
                      }))
                    }
                  />
                </div>

                <h3 style={{ fontSize: 15, margin: "18px 0 12px" }}>
                  Account preferences
                </h3>
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
                  {loadingUploadRequirements ? (
                    <p role="status" style={{ margin: 0, color: "var(--text-muted)", fontSize: 12 }}>
                      Loading secure upload requirements...
                    </p>
                  ) : uploadRequirementsError ? (
                    <p role="alert" style={{ margin: 0, color: "var(--rose)", fontSize: 12 }}>
                      {uploadRequirementsError}
                    </p>
                  ) : uploadRequirements ? (
                    <p
                    style={{
                      margin: 0,
                      color: "var(--text-muted)",
                      fontSize: 12,
                    }}
                  >
                    Accepted formats: {uploadRequirements.acceptedMimeTypes.join(", ")}.
                    {" "}Maximum {formatFileSize(uploadRequirements.maxDocumentSizeBytes)} per file
                    {" "}({uploadRequirements.maxDocumentCount} files total).
                  </p>
                  ) : null}
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

                    <label
                      htmlFor={`document-${document.type}`}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const droppedFile = event.dataTransfer.files[0];
                        if (droppedFile) {
                          handleFileChange(document.type, droppedFile);
                        }
                      }}
                      style={{
                        display: "grid",
                        gap: 8,
                        padding: 14,
                        border: "1px dashed var(--border-subtle)",
                        borderRadius: 10,
                        cursor: creating || !uploadRequirements ? "not-allowed" : "pointer",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Upload size={16} />
                        Drop a file here or choose one
                      </span>
                      <input
                        id={`document-${document.type}`}
                        type="file"
                        accept={uploadRequirements?.acceptedMimeTypes.join(",")}
                        required={!files[document.type]}
                        disabled={
                          creating ||
                          loadingUploadRequirements ||
                          !uploadRequirements
                        }
                        onChange={(event) => {
                          handleFileChange(
                            document.type,
                            event.target.files?.[0]
                          );
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>

                    {files[document.type] && (
                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                          marginTop: 8,
                          padding: 10,
                          border: "1px solid var(--border-subtle)",
                          borderRadius: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 8,
                          }}
                        >
                          <div style={{ minWidth: 0, fontSize: 12 }}>
                            {files[document.type]?.type.startsWith("image/") ? (
                              <FileImage size={15} aria-hidden="true" />
                            ) : (
                              <FileText size={15} aria-hidden="true" />
                            )}
                            <div style={{ overflowWrap: "anywhere" }}>
                              {files[document.type]?.name}
                            </div>
                            <div style={{ color: "var(--text-muted)" }}>
                              {formatFileSize(files[document.type]?.size ?? 0)}
                              {" · "}
                              {files[document.type]?.type}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={creating}
                            onClick={() =>
                              handleFileChange(document.type, undefined)
                            }
                            aria-label={`Remove ${document.label}`}
                          >
                            <Trash2 size={14} />
                            Remove / replace
                          </button>
                        </div>
                        <LocalDocumentPreview file={files[document.type]!} />
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
                {creating && (
                  <p role="status" aria-live="polite">
                    Uploading documents and checking readability. Please keep
                    this window open.
                  </p>
                )}
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
                  disabled={
                    creating ||
                    loadingUploadRequirements ||
                    !uploadRequirements
                  }
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
