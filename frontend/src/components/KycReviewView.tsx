
import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  User,
  Mail,
  Phone,
  MapPin,
  Clock,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  FileText,
  Eye,
  X,
  LoaderCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { api } from "../services/api";

interface KycReviewViewProps {
  token: string;
  onToast: (msg: string) => void;
}

type KycStatus = "all" | "pending" | "verified" | "rejected";
type ReviewDecision = "verified" | "rejected";

interface KycCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  kycStatus: "pending" | "verified" | "rejected";
  status?: string;
  createdAt?: string;
  remarks?: string;

  // These fields can be populated when the backend supports uploads.
  kycDocuments?: Array<{
    name?: string;
    documentType?: string;
    url?: string;
    fileUrl?: string;
    status?: string;
  }>;
  documents?: Array<{
    name?: string;
    documentType?: string;
    url?: string;
    fileUrl?: string;
    status?: string;
  }>;
}

const KYC_STATUS_CONFIG = {
  pending: {
    label: "Pending Review",
    color: "var(--amber)",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.25)",
    icon: ShieldAlert,
  },
  verified: {
    label: "Verified",
    color: "var(--emerald)",
    bg: "rgba(16,185,129,0.1)",
    border: "rgba(16,185,129,0.25)",
    icon: ShieldCheck,
  },
  rejected: {
    label: "Rejected",
    color: "var(--rose)",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.25)",
    icon: ShieldX,
  },
};

const formatDate = (value?: string) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const KycStatusPill: React.FC<{ status?: string }> = ({ status }) => {
  const normalizedStatus =
    status === "verified" || status === "rejected"
      ? status
      : "pending";

  const config = KYC_STATUS_CONFIG[normalizedStatus];
  const Icon = config.icon;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
        color: config.color,
        background: config.bg,
        border: `1px solid ${config.border}`,
      }}
    >
      <Icon size={12} />
      {config.label}
    </span>
  );
};

const SmallLabel: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    style={{
      fontSize: 10.5,
      color: "var(--text-faint)",
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    }}
  >
    {children}
  </div>
);

/* =========================================================
   KYC DETAIL DRAWER
========================================================= */

interface KycDetailDrawerProps {
  customer: KycCustomer;
  onClose: () => void;
  onUpdate: (
    id: string,
    status: ReviewDecision,
    remarks: string
  ) => Promise<void>;
}

const KycDetailDrawer: React.FC<KycDetailDrawerProps> = ({
  customer,
  onClose,
  onUpdate,
}) => {
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [localError, setLocalError] = useState("");

  const handleDecision = async (status: ReviewDecision) => {
    if (loading) return;

    if (status === "rejected" && !remarks.trim()) {
      setLocalError("Please enter rejection remarks before rejecting KYC.");
      return;
    }

    setLocalError("");
    setLoading(true);
    setDecision(status);

    try {
      await onUpdate(customer.id, status, remarks.trim());

      // Close only after the parent confirms a successful API update.
      onClose();
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "Unable to update KYC. Please try again."
      );
    } finally {
      setLoading(false);
      setDecision(null);
    }
  };

  const fields = [
    { icon: User, label: "Full Name", value: customer.name },
    { icon: Mail, label: "Email Address", value: customer.email },
    { icon: Phone, label: "Phone Number", value: customer.phone },
    { icon: MapPin, label: "Registered Address", value: customer.address },
    {
      icon: Clock,
      label: "Registration Date",
      value: formatDate(customer.createdAt),
    },
  ];

  const documents = customer.kycDocuments || customer.documents || [];

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kyc-review-title"
        style={{
          width: "100%",
          maxWidth: 600,
          background: "var(--bg-surface)",
          borderRadius: 18,
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          overflow: "hidden",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background:
              "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(59,130,246,0.06))",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--emerald)",
                flexShrink: 0,
              }}
            >
              <FileText size={20} />
            </div>

            <div>
              <div
                id="kyc-review-title"
                style={{
                  fontWeight: 800,
                  fontSize: 16,
                  color: "var(--text-main)",
                }}
              >
                KYC Document Review
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-faint)",
                  marginTop: 3,
                }}
              >
                Customer ID: {customer.id.slice(-8).toUpperCase()}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close KYC review"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-muted)",
              cursor: loading ? "not-allowed" : "pointer",
              padding: "7px 9px",
              borderRadius: 8,
              flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer body */}
        <div style={{ padding: 24, overflowY: "auto" }}>
          {/* Customer identity */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, var(--emerald), var(--sapphire))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 800,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {(customer.name || "C").charAt(0).toUpperCase()}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 20,
                  color: "var(--text-main)",
                  overflowWrap: "anywhere",
                }}
              >
                {customer.name || "Unnamed customer"}
              </div>
              <div style={{ marginTop: 7 }}>
                <KycStatusPill status={customer.kycStatus} />
              </div>
            </div>
          </div>

          {/* Customer details */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginBottom: 24,
            }}
          >
            {fields.map((field) => {
              const Icon = field.icon;

              return (
                <div
                  key={field.label}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "11px 14px",
                    borderRadius: 10,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <Icon
                    size={15}
                    color="var(--text-faint)"
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <SmallLabel>{field.label}</SmallLabel>
                    <div
                      style={{
                        fontSize: 13.5,
                        color: "var(--text-main)",
                        fontWeight: 600,
                        marginTop: 3,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {field.value || "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actual uploaded documents, if the backend provides them */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: 10,
              }}
            >
              <FileText size={15} />
              Uploaded KYC Documents
            </div>

            {documents.length === 0 ? (
              <div
                style={{
                  padding: 18,
                  borderRadius: 12,
                  border: "1px dashed var(--border-subtle)",
                  background: "var(--bg-elevated)",
                  textAlign: "center",
                }}
              >
                <AlertCircle
                  size={24}
                  color="var(--amber)"
                  style={{ marginBottom: 8 }}
                />

                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text-main)",
                    marginBottom: 5,
                  }}
                >
                  No document files available
                </div>

                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: "var(--text-muted)",
                  }}
                >
                  The current KYC API returns customer details and status,
                  but does not return uploaded document files. The checklist
                  cannot confirm document submission until the backend
                  provides the stored document information.
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {documents.map((doc, index) => {
                  const url = doc.url || doc.fileUrl;
                  const name =
                    doc.name || doc.documentType || `Document ${index + 1}`;

                  return (
                    <div
                      key={`${name}-${index}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: 12,
                        borderRadius: 10,
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          minWidth: 0,
                        }}
                      >
                        <FileText
                          size={19}
                          color="var(--sapphire)"
                          style={{ flexShrink: 0 }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "var(--text-main)",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-muted)",
                              marginTop: 3,
                            }}
                          >
                            {doc.status || (url ? "File available" : "No file URL")}
                          </div>
                        </div>
                      </div>

                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${name}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            color: "var(--sapphire)",
                            fontSize: 12,
                            fontWeight: 700,
                            textDecoration: "none",
                            flexShrink: 0,
                          }}
                        >
                          <Eye size={14} />
                          View
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--text-faint)",
                            flexShrink: 0,
                          }}
                        >
                          No file
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Review remarks */}
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="kyc-review-remarks"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--text-muted)",
                display: "block",
                marginBottom: 7,
              }}
            >
              Staff Review Remarks
              <span style={{ fontWeight: 500 }}>
                {" "}
                (required for rejection)
              </span>
            </label>

            <textarea
              id="kyc-review-remarks"
              rows={3}
              placeholder="Enter verification notes or the reason for rejection..."
              value={remarks}
              disabled={loading}
              onChange={(event) => {
                setRemarks(event.target.value);
                if (localError) setLocalError("");
              }}
              style={{
                width: "100%",
                resize: "vertical",
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 13,
                lineHeight: 1.5,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Error message */}
          {localError && (
            <div
              role="alert"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: 12,
                marginBottom: 16,
                borderRadius: 9,
                color: "var(--rose)",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              {localError}
            </div>
          )}

          {/* Action buttons */}
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {customer.kycStatus !== "verified" && (
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  flex: "1 1 150px",
                  justifyContent: "center",
                  opacity: loading ? 0.7 : 1,
                }}
                onClick={() => handleDecision("verified")}
                disabled={loading}
              >
                {loading && decision === "verified" ? (
                  <LoaderCircle size={15} />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                {loading && decision === "verified"
                  ? "Approving..."
                  : "Approve KYC"}
              </button>
            )}

            {customer.kycStatus !== "rejected" && (
              <button
                type="button"
                className="btn btn-danger"
                style={{
                  flex: "1 1 150px",
                  justifyContent: "center",
                  opacity: loading ? 0.7 : 1,
                }}
                onClick={() => handleDecision("rejected")}
                disabled={loading}
              >
                {loading && decision === "rejected" ? (
                  <LoaderCircle size={15} />
                ) : (
                  <XCircle size={15} />
                )}
                {loading && decision === "rejected"
                  ? "Rejecting..."
                  : "Reject KYC"}
              </button>
            )}
          </div>

          {customer.kycStatus === "verified" && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: "var(--emerald)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <ShieldCheck size={15} />
              This customer's KYC is already verified.
            </div>
          )}

          {customer.kycStatus === "rejected" && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: "var(--rose)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <ShieldX size={15} />
              This customer's KYC is currently rejected.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   MAIN KYC REVIEW VIEW
========================================================= */

export const KycReviewView: React.FC<KycReviewViewProps> = ({
  token,
  onToast,
}) => {
  const [customers, setCustomers] = useState<KycCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<KycStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<KycCustomer | null>(null);
  const [kycRemarks, setKycRemarks] = useState<Record<string, string>>({});

  const loadCustomers = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.getStaffKycCustomers(token);
      const receivedCustomers = (response.customers || []) as KycCustomer[];

      setCustomers(receivedCustomers);

      // Keep the selected customer synchronized after a refresh.
      setSelectedCustomer((current) => {
        if (!current) return null;

        return (
          receivedCustomers.find((customer) => customer.id === current.id) ||
          null
        );
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load the KYC queue.";

      onToast(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [token, onToast]);

  useEffect(() => {
    let active = true;

    const initialLoad = async () => {
      try {
        const response = await api.getStaffKycCustomers(token);

        if (active) {
          setCustomers((response.customers || []) as KycCustomer[]);
        }
      } catch (error) {
        if (active) {
          onToast(
            error instanceof Error
              ? error.message
              : "Failed to load the KYC queue."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    setLoading(true);
    void initialLoad();

    return () => {
      active = false;
    };
  }, [token, onToast]);

  const handleUpdateKyc = async (
    id: string,
    status: ReviewDecision,
    remarks: string
  ): Promise<void> => {
    setUpdatingId(id);

    try {
      const response = await api.updateKycStatus(
        token,
        id,
        status,
        remarks
      );

      // Update the visible row immediately from the confirmed API result.
      setCustomers((previous) =>
        previous.map((customer) =>
          customer.id === id
            ? {
                ...customer,
                kycStatus: response.customer?.kycStatus || status,
                remarks,
              }
            : customer
        )
      );

      onToast(
        `KYC ${status === "verified" ? "approved" : "rejected"} successfully.`
      );

      // Reload to ensure the list reflects the persisted backend state.
      try {
        await loadCustomers();
      } catch {
        // The update itself succeeded. The next manual refresh can reload
        // the list if this follow-up request fails.
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update KYC.";

      onToast(message);

      // Important: rethrow so the drawer does not close on failure.
      throw error;
    } finally {
      setUpdatingId(null);
    }
  };

  const handleQuickAction = async (
    customer: KycCustomer,
    status: ReviewDecision
  ) => {
    if (updatingId) return;

    const remarks = kycRemarks[customer.id] || "";

    if (status === "rejected" && !remarks.trim()) {
      onToast("Enter rejection remarks before rejecting this customer.");
      return;
    }

    setUpdatingId(customer.id);

    try {
      await handleUpdateKyc(customer.id, status, remarks.trim());

      setKycRemarks((previous) => {
        const next = { ...previous };
        delete next[customer.id];
        return next;
      });
    } catch {
      // handleUpdateKyc already displays the API error.
    } finally {
      setUpdatingId(null);
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filtered = customers.filter((customer) => {
    const matchesStatus =
      filterStatus === "all" || customer.kycStatus === filterStatus;

    const matchesSearch =
      !normalizedQuery ||
      (customer.name || "").toLowerCase().includes(normalizedQuery) ||
      (customer.email || "").toLowerCase().includes(normalizedQuery) ||
      (customer.phone || "").toLowerCase().includes(normalizedQuery);

    return matchesStatus && matchesSearch;
  });

  const counts = {
    all: customers.length,
    pending: customers.filter((customer) => customer.kycStatus === "pending")
      .length,
    verified: customers.filter((customer) => customer.kycStatus === "verified")
      .length,
    rejected: customers.filter((customer) => customer.kycStatus === "rejected")
      .length,
  };

  const filterItems = [
    {
      key: "all" as KycStatus,
      label: "All Customers",
      color: "var(--sapphire)",
      icon: User,
    },
    {
      key: "pending" as KycStatus,
      label: "Pending Review",
      color: "var(--amber)",
      icon: ShieldAlert,
    },
    {
      key: "verified" as KycStatus,
      label: "KYC Verified",
      color: "var(--emerald)",
      icon: ShieldCheck,
    },
    {
      key: "rejected" as KycStatus,
      label: "KYC Rejected",
      color: "var(--rose)",
      icon: ShieldX,
    },
  ];

  return (
    <>
      {selectedCustomer && (
        <KycDetailDrawer
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onUpdate={handleUpdateKyc}
        />
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          minWidth: 0,
        }}
      >
        {/* Summary filters */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
            gap: 14,
          }}
        >
          {filterItems.map((item) => {
            const Icon = item.icon;
            const active = filterStatus === item.key;

            return (
              <button
                type="button"
                key={item.key}
                onClick={() => setFilterStatus(item.key)}
                aria-pressed={active}
                style={{
                  background: active
                    ? `linear-gradient(135deg, ${item.color}14, ${item.color}06)`
                    : "var(--bg-elevated)",
                  border: active
                    ? `1.5px solid ${item.color}40`
                    : "1px solid var(--border-subtle)",
                  borderRadius: 14,
                  padding: "16px 18px",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  minWidth: 0,
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
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: item.color,
                      lineHeight: 1,
                    }}
                  >
                    {counts[item.key]}
                  </div>
                  <Icon
                    size={18}
                    color={item.color}
                    style={{ opacity: 0.75, flexShrink: 0 }}
                  />
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    fontWeight: 600,
                    marginTop: 8,
                  }}
                >
                  {item.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Search and refresh */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              position: "relative",
              flex: "1 1 240px",
              minWidth: 0,
            }}
          >
            <Search
              size={15}
              color="var(--text-faint)"
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              aria-label="Search KYC customers"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              style={{
                paddingLeft: 36,
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void loadCustomers().catch(() => {})}
            disabled={loading || Boolean(updatingId)}
            style={{ flexShrink: 0 }}
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin" : ""}
            />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* KYC queue */}
        <div className="card-panel" style={{ padding: 0, minWidth: 0 }}>
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 14.5,
                color: "var(--text-main)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ShieldAlert size={16} color="var(--amber)" />
              KYC Document Review Queue
            </div>

            <span
              style={{
                fontSize: 12,
                color: "var(--text-faint)",
                background: "var(--bg-elevated)",
                padding: "3px 10px",
                borderRadius: 6,
                border: "1px solid var(--border-subtle)",
              }}
            >
              {filtered.length} records
            </span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact Details</th>
                  <th>Address</th>
                  <th>KYC Status</th>
                  <th>Account Status</th>
                  <th>Joined</th>
                  <th>Remarks</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading && customers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        textAlign: "center",
                        padding: 48,
                        color: "var(--text-faint)",
                      }}
                    >
                      <LoaderCircle
                        size={22}
                        style={{
                          display: "block",
                          margin: "0 auto 12px",
                        }}
                      />
                      Loading KYC queue...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        textAlign: "center",
                        padding: 48,
                        color: "var(--text-muted)",
                      }}
                    >
                      <ShieldCheck
                        size={32}
                        style={{
                          display: "block",
                          margin: "0 auto 12px",
                          opacity: 0.25,
                        }}
                      />

                      <div style={{ fontWeight: 700, marginBottom: 5 }}>
                        No customers found
                      </div>

                      <div style={{ fontSize: 12 }}>
                        Try another status filter or search term.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((customer) => (
                    <tr key={customer.id}>
                      {/* Customer */}
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: "50%",
                              flexShrink: 0,
                              background:
                                "linear-gradient(135deg, var(--emerald), var(--sapphire))",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 15,
                              fontWeight: 800,
                              color: "#fff",
                            }}
                          >
                            {(customer.name || "C")
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                color: "var(--text-main)",
                                fontSize: 13.5,
                              }}
                            >
                              {customer.name || "Unnamed customer"}
                            </div>
                            <div
                              style={{
                                fontSize: 10.5,
                                color: "var(--text-faint)",
                                fontFamily: "monospace",
                              }}
                            >
                              {customer.id.slice(-8).toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td>
                        <div
                          style={{
                            fontSize: 13,
                            color: "var(--text-main)",
                          }}
                        >
                          {customer.email || "—"}
                        </div>

                        <div
                          style={{
                            fontSize: 11.5,
                            color: "var(--text-faint)",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            marginTop: 4,
                          }}
                        >
                          <Phone size={10} />
                          {customer.phone || "—"}
                        </div>
                      </td>

                      {/* Address */}
                      <td
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          maxWidth: 180,
                        }}
                      >
                        {customer.address || "—"}
                      </td>

                      {/* KYC status */}
                      <td>
                        <KycStatusPill status={customer.kycStatus} />
                      </td>

                      {/* Account status */}
                      <td>
                        <span
                          className={`status-pill ${customer.status || "active"}`}
                        >
                          {customer.status || "active"}
                        </span>
                      </td>

                      {/* Registration date */}
                      <td
                        style={{
                          fontSize: 12,
                          color: "var(--text-faint)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDate(customer.createdAt)}
                      </td>

                      {/* Remarks */}
                      <td>
                        <input
                          type="text"
                          aria-label={`Review remarks for ${customer.name}`}
                          placeholder="Remarks..."
                          value={kycRemarks[customer.id] || ""}
                          disabled={Boolean(updatingId)}
                          onChange={(event) =>
                            setKycRemarks((previous) => ({
                              ...previous,
                              [customer.id]: event.target.value,
                            }))
                          }
                          style={{
                            padding: "6px 10px",
                            fontSize: 12,
                            width: 160,
                            boxSizing: "border-box",
                          }}
                        />
                      </td>

                      {/* Actions */}
                      <td
                        style={{
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            justifyContent: "flex-end",
                            alignItems: "center",
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{
                              background: "rgba(59,130,246,0.1)",
                              color: "var(--sapphire)",
                              border: "1px solid rgba(59,130,246,0.2)",
                              padding: "5px 10px",
                            }}
                            onClick={() => setSelectedCustomer(customer)}
                          >
                            <Eye size={13} />
                            Review
                          </button>

                          {customer.kycStatus !== "verified" && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={Boolean(updatingId)}
                              onClick={() =>
                                void handleQuickAction(
                                  customer,
                                  "verified"
                                )
                              }
                            >
                              {updatingId === customer.id ? (
                                <LoaderCircle size={13} />
                              ) : (
                                <CheckCircle2 size={13} />
                              )}
                              Approve
                            </button>
                          )}

                          {customer.kycStatus !== "rejected" && (
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              disabled={Boolean(updatingId)}
                              onClick={() =>
                                void handleQuickAction(
                                  customer,
                                  "rejected"
                                )
                              }
                            >
                              <XCircle size={13} />
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default KycReviewView;
