
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

import { CustomerDirectoryView } from "./CustomerDirectoryView";
import { KycReviewView } from "./KycReviewView";

import {
  Landmark,
  Users,
  CheckCircle,
  XCircle,
  DollarSign,
  FileCheck,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Activity,
  Wifi,
  WifiOff,
  TrendingUp,
  AlertTriangle,
  Info,
  ArrowRightLeft,
  CreditCard,
  PiggyBank,
  BadgeCheck,
  Clock,
} from "lucide-react";

import {
  api,
  type StaffMetrics,
  type CreditCardApplication,
} from "../services/api";

type StaffTab =
  | "live"
  | "teller"
  | "kyc"
  | "loans"
  | "accounts"
  | "customers"
  | "credit-cards";

interface StaffPortalViewProps {
  token: string;
  onToast: (message: string) => void;
  onShowReceipt: (receipt: any) => void;
  initialTab?: StaffTab;
}

interface LiveEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "success" | "critical";
  timestamp: string;
  data: Record<string, any>;
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  CUSTOMER_DEPOSIT: ArrowDownLeft,
  CUSTOMER_WITHDRAWAL: ArrowUpRight,
  CUSTOMER_TRANSFER: ArrowRightLeft,
  CUSTOMER_ACCOUNT_OPENED: CreditCard,
  CUSTOMER_LOAN_APPLIED: TrendingUp,
  CUSTOMER_FD_OPENED: PiggyBank,
  CUSTOMER_KYC_UPDATED: BadgeCheck,
  CUSTOMER_PROFILE_UPDATED: Users,
  ACCOUNT_STATUS_CHANGED: AlertTriangle,
};

const SEVERITY_COLORS: Record<string, string> = {
  success: "var(--emerald)",
  warning: "var(--amber)",
  info: "var(--sapphire)",
  critical: "var(--rose)",
};

const SEVERITY_BG: Record<string, string> = {
  success: "rgba(16,185,129,0.08)",
  warning: "rgba(245,158,11,0.08)",
  info: "rgba(59,130,246,0.08)",
  critical: "rgba(239,68,68,0.08)",
};

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatAmount(amount?: number): string {
  if (amount == null || !Number.isFinite(amount)) {
    return "";
  }

  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatRupeesFromPaise(amountPaise?: number): string {
  const amount = Number(amountPaise ?? 0) / 100;

  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const LiveEventCard: React.FC<{
  event: LiveEvent;
  isNew?: boolean;
}> = ({ event, isNew = false }) => {
  const Icon = EVENT_ICONS[event.type] || Info;
  const color =
    SEVERITY_COLORS[event.severity] || "var(--sapphire)";
  const background =
    SEVERITY_BG[event.severity] || SEVERITY_BG.info;

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 12,
        background,
        border: `1px solid ${color}22`,
        marginBottom: 10,
        animation: isNew ? "slideInEvent 0.4s ease" : "none",
        transition: "all 0.2s ease",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${color}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color,
        }}
      >
        <Icon size={18} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
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
              fontWeight: 700,
              fontSize: 13.5,
              color: "var(--text-main)",
              overflowWrap: "anywhere",
            }}
          >
            {event.title || "Activity"}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              flexShrink: 0,
            }}
          >
            {isNew && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#fff",
                  background: color,
                  borderRadius: 4,
                  padding: "2px 6px",
                }}
              >
                LIVE
              </span>
            )}

            <span
              style={{
                fontSize: 11,
                color: "var(--text-faint)",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Clock size={10} />
              {formatTime(event.timestamp)}
            </span>
          </div>
        </div>

        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            marginTop: 3,
            lineHeight: 1.45,
            overflowWrap: "anywhere",
          }}
        >
          {event.message || "An activity was recorded."}
        </div>

        {event.data?.amount != null && (
          <div
            style={{
              marginTop: 6,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color,
              }}
            >
              {formatAmount(Number(event.data.amount))}
            </span>

            {event.data.accountNumber && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-faint)",
                  fontFamily: "monospace",
                }}
              >
                {event.data.accountNumber}
              </span>
            )}

            {event.data.recipientAccountNumber && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-faint)",
                  fontFamily: "monospace",
                }}
              >
                → {event.data.recipientAccountNumber}
              </span>
            )}

            {event.data.balance !== undefined && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-faint)",
                }}
              >
                Balance: ₹
                {Number(event.data.balance).toLocaleString("en-IN")}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const StaffPortalView: React.FC<StaffPortalViewProps> = ({
  token,
  onToast,
  onShowReceipt,
  initialTab = "live",
}) => {
  const [activeTab, setActiveTab] = useState<StaffTab>(initialTab);

  const [metrics, setMetrics] = useState<StaffMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  // Teller state
  const [tellerAccNum, setTellerAccNum] = useState("");
  const [tellerAmount, setTellerAmount] = useState("");
  const [tellerRemarks, setTellerRemarks] = useState("");
  const [tellerLoading, setTellerLoading] = useState(false);
  const [tellerError, setTellerError] = useState("");

  // Staff data
  const [kycCustomers, setKycCustomers] = useState<any[]>([]);
  const [allLoans, setAllLoans] = useState<any[]>([]);
  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>(
    {}
  );

  // Credit card application review
  const [creditCardApplications, setCreditCardApplications] = useState<
    CreditCardApplication[]
  >([]);
  const [loadingCreditCards, setLoadingCreditCards] = useState(false);
  const [reviewingCardId, setReviewingCardId] = useState<string | null>(
    null
  );

  // Live activity
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const [sseConnected, setSseConnected] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const eventTimersRef = useRef<ReturnType<typeof window.setTimeout>[]>(
    []
  );

  // Keep the selected tab synchronized with the parent sidebar.
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadStaffData = useCallback(async () => {
    if (!token) return;

    setLoading(true);

    try {
      const [metricsRes, kycRes, loansRes, accountsRes] =
        await Promise.all([
          api.getStaffMetrics(token),
          api.getStaffKycCustomers(token),
          api.getAllLoans(token),
          api.getAllAccounts(token),
        ]);

      setMetrics(metricsRes.metrics);
      setKycCustomers(kycRes.customers || []);
      setAllLoans(loansRes.loans || []);
      setAllAccounts(accountsRes.accounts || []);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load staff portal data.";

      onToast(message);
    } finally {
      setLoading(false);
    }
  }, [token, onToast]);

  const loadLiveActivity = useCallback(async () => {
    if (!token) return;

    setLiveLoading(true);

    try {
      const response = await api.getLiveActivity(token, 40);
      setLiveEvents(response.activities || []);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load live activity.";

      onToast(message);
    } finally {
      setLiveLoading(false);
    }
  }, [token, onToast]);

  // Load credit card applications from the backend.
  const loadCreditCardApplications = useCallback(async () => {
    if (!token) return;

    setLoadingCreditCards(true);

    try {
      const response = await api.getCreditCardApplications(token);
      setCreditCardApplications(response.applications ?? []);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load credit card applications.";

      console.error("Failed to load credit card applications:", error);
      onToast(message);
    } finally {
      setLoadingCreditCards(false);
    }
  }, [token, onToast]);

  // Load applications whenever the Credit Cards tab becomes active.
  useEffect(() => {
    if (activeTab === "credit-cards") {
      void loadCreditCardApplications();
    }
  }, [activeTab, loadCreditCardApplications]);

  // Open the live activity stream. Any previous stream is closed first.
  const connectSSE = useCallback(() => {
    if (!token) return;

    eventSourceRef.current?.close();
    setSseConnected(false);

    try {
      const eventSource = api.createLiveStream(token);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.onerror = () => {
        setSseConnected(false);
      };

      eventSource.onmessage = (messageEvent: MessageEvent) => {
        try {
          const data = JSON.parse(messageEvent.data);

          if (data.type === "SYSTEM_CONNECTED") {
            setSseConnected(true);
            return;
          }

          if (!data.id) return;

          const event = data as LiveEvent;

          setLiveEvents((previous) => {
            if (previous.some((item) => item.id === event.id)) {
              return previous;
            }

            return [event, ...previous].slice(0, 60);
          });

          setNewEventIds((previous) => {
            const next = new Set(previous);
            next.add(event.id);
            return next;
          });

          const timer = window.setTimeout(() => {
            setNewEventIds((previous) => {
              const next = new Set(previous);
              next.delete(event.id);
              return next;
            });
          }, 6000);

          eventTimersRef.current.push(timer);

          feedRef.current?.scrollTo({
            top: 0,
            behavior: "smooth",
          });

          void api
            .getStaffMetrics(token)
            .then((response) => setMetrics(response.metrics))
            .catch(() => {
              // A later refresh can recover the metrics.
            });
        } catch (error: unknown) {
          console.error("Unable to process live activity event:", error);
        }
      };
    } catch (error: unknown) {
      setSseConnected(false);
      onToast(
        error instanceof Error
          ? error.message
          : "Unable to connect to the live activity stream."
      );
    }
  }, [token, onToast]);

  useEffect(() => {
    if (!token) return;

    void loadStaffData();
    void loadLiveActivity();
    connectSSE();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;

      eventTimersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      eventTimersRef.current = [];
    };
  }, [token, loadStaffData, loadLiveActivity, connectSSE]);

  // Teller cash deposit.
  const handleTellerDeposit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setTellerError("");

    const accountNumber = tellerAccNum.trim();
    const amount = Number(tellerAmount);

    if (!accountNumber) {
      setTellerError("Enter the customer account number.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setTellerError("Enter a valid deposit amount.");
      return;
    }

    setTellerLoading(true);

    try {
      const response = await api.tellerDeposit(token, {
        accountNumber,
        amountRupees: amount,
        remarks: tellerRemarks.trim(),
      });

      onToast(
        `Teller deposit of ₹${amount.toLocaleString("en-IN")} processed successfully.`
      );

      setTellerAmount("");
      setTellerRemarks("");

      await loadStaffData();

      if (response.transaction?.reference) {
        onShowReceipt({
          reference: response.transaction.reference,
          date: new Date().toISOString(),
          type: "teller_deposit",
          category: "Branch Cash Deposit",
          amount,
          description: `Branch cash deposit for account ${accountNumber}`,
          recipient: {
            name: response.transaction.customerName,
            accountNumber,
          },
        });
      }
    } catch (error: unknown) {
      setTellerError(
        error instanceof Error ? error.message : "Teller deposit failed."
      );
    } finally {
      setTellerLoading(false);
    }
  };

  // Teller cash withdrawal.
  const handleTellerWithdraw = async () => {
    setTellerError("");

    const accountNumber = tellerAccNum.trim();
    const amount = Number(tellerAmount);

    if (!accountNumber) {
      setTellerError("Enter the customer account number.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setTellerError("Enter a valid withdrawal amount.");
      return;
    }

    const confirmed = window.confirm(
      `Process a cash withdrawal of ₹${amount.toLocaleString("en-IN")} for account ${accountNumber}?`
    );

    if (!confirmed) return;

    setTellerLoading(true);

    try {
      const response = await api.tellerWithdraw(token, {
        accountNumber,
        amountRupees: amount,
        remarks: tellerRemarks.trim(),
      });

      onToast(
        `Teller cash withdrawal of ₹${amount.toLocaleString("en-IN")} completed successfully.`
      );

      setTellerAmount("");
      setTellerRemarks("");

      await loadStaffData();

      if (response.transaction?.reference) {
        onShowReceipt({
          reference: response.transaction.reference,
          date: new Date().toISOString(),
          type: "teller_withdrawal",
          category: "Branch Cash Withdrawal",
          amount,
          description: `Branch cash withdrawal from account ${accountNumber}`,
          recipient: {
            name: response.transaction.customerName,
            accountNumber,
          },
        });
      }
    } catch (error: unknown) {
      setTellerError(
        error instanceof Error
          ? error.message
          : "Teller withdrawal failed."
      );
    } finally {
      setTellerLoading(false);
    }
  };

  // Loan review.
  const handleReviewLoan = async (
    loanId: string,
    action: "approve" | "reject"
  ) => {
    const notes = (reviewNotes[loanId] || "").trim();

    if (action === "reject" && !notes) {
      window.alert(
        "Please provide review notes or a reason before rejecting."
      );
      return;
    }

    try {
      await api.reviewLoan(token, loanId, action, notes);

      onToast(
        action === "approve"
          ? "Loan application approved and processed."
          : "Loan application rejected."
      );

      await loadStaffData();
    } catch (error: unknown) {
      onToast(
        error instanceof Error ? error.message : "Failed to review loan."
      );
    }
  };

  // Approve or reject a credit card application.
  const handleReviewCreditCard = async (
    application: CreditCardApplication,
    decision: "approve" | "reject"
  ) => {
    if (application.status !== "pending") {
      onToast("This application has already been reviewed.");
      return;
    }

    const notes =
      decision === "reject"
        ? window.prompt("Enter a reason for rejecting this application:")?.trim()
        : "";

    if (decision === "reject" && !notes) {
      onToast("Please provide a reason before rejecting the application.");
      return;
    }

    const actionLabel = decision === "approve" ? "approve" : "reject";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} the credit card application for ${application.cardNumberMasked}?`
    );

    if (!confirmed) return;

    setReviewingCardId(application.id);

    try {
      const approvedLimitRupees =
        decision === "approve"
          ? application.requestedLimitPaise / 100
          : undefined;

      await api.reviewCreditCardApplication(
        token,
        application.id,
        decision,
        approvedLimitRupees
      );

      onToast(
        decision === "approve"
          ? "Credit card application approved successfully."
          : "Credit card application rejected successfully."
      );

      await loadCreditCardApplications();
    } catch (error: unknown) {
      onToast(
        error instanceof Error
          ? error.message
          : "Failed to review credit card application."
      );
    } finally {
      setReviewingCardId(null);
    }
  };

  // Freeze or activate an account.
  const handleToggleAccountFreeze = async (account: any) => {
    const nextStatus =
      account.status === "active" ? "frozen" : "active";

    const confirmed = window.confirm(
      `Change account ${account.accountNumber} status to "${nextStatus.toUpperCase()}"?`
    );

    if (!confirmed) return;

    try {
      await api.updateAccountStatus(token, account.id, nextStatus);

      onToast(
        `Account ${account.accountNumber} is now ${nextStatus}.`
      );

      await loadStaffData();
    } catch (error: unknown) {
      onToast(
        error instanceof Error
          ? error.message
          : "Failed to change account status."
      );
    }
  };

  const pendingKycCount = kycCustomers.filter(
    (customer) => customer.kycStatus === "pending"
  ).length;

  const pendingLoansCount = allLoans.filter(
    (loan) => loan.status === "pending"
  ).length;

  const pendingCreditCardsCount = creditCardApplications.filter(
    (application) => application.status === "pending"
  ).length;

  const handleTabChange = (tab: StaffTab) => {
    setActiveTab(tab);
  };

  return (
    <div className="staff-portal">
      <style>{`
        @keyframes slideInEvent {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .live-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--emerald);
          animation: pulse-dot 1.5s ease-in-out infinite;
        }

        .live-dot.offline {
          background: var(--rose);
          animation: none;
        }

        .staff-tab-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          white-space: nowrap;
          cursor: pointer;
        }

        .staff-tab-button:focus-visible {
          outline: 2px solid var(--sapphire);
          outline-offset: 3px;
        }

        .staff-review-actions {
          display: flex;
          gap: 6px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .staff-card-summary {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
          padding: 16px;
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          background: var(--surface-1);
        }

        .staff-card-summary-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(59,130,246,0.1);
          color: var(--sapphire);
          flex-shrink: 0;
        }

        @media (max-width: 900px) {
          .staff-live-layout,
          .staff-two-column-layout {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }

        @media (max-width: 600px) {
          .staff-tab-list {
            gap: 8px !important;
          }

          .staff-tab-button {
            flex: 1 1 calc(50% - 8px);
          }

          .staff-review-actions {
            justify-content: flex-start;
          }
        }
      `}</style>

      {/* Page heading */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff Operations Centre</h1>
          <p className="page-subtitle">
            Real-time customer activity, branch teller desk, KYC
            verifications, loan approvals and credit card reviews
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            void loadStaffData();
            void loadLiveActivity();

            if (activeTab === "credit-cards") {
              void loadCreditCardApplications();
            }
          }}
          disabled={loading || liveLoading || loadingCreditCards}
        >
          <RefreshCw
            size={16}
            className={
              loading || liveLoading || loadingCreditCards ? "spin" : ""
            }
          />
          Refresh
        </button>
      </div>

      {/* Dashboard metrics */}
      <div
        className="stats-grid"
        style={{
          marginBottom: 24,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        }}
      >
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Live Feed</span>
            <div
              className="stat-icon"
              style={{
                background: sseConnected
                  ? "rgba(16,185,129,0.1)"
                  : "rgba(239,68,68,0.1)",
                color: sseConnected ? "var(--emerald)" : "var(--rose)",
              }}
            >
              {sseConnected ? <Wifi size={20} /> : <WifiOff size={20} />}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
            }}
          >
            <span
              className={`live-dot${sseConnected ? "" : " offline"}`}
            />
            <span
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: sseConnected ? "var(--emerald)" : "var(--rose)",
              }}
            >
              {sseConnected ? "Connected" : "Offline"}
            </span>
          </div>

          <div className="stat-footer">
            {liveEvents.length} events buffered
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Today's Transactions</span>
            <div
              className="stat-icon"
              style={{
                background: "rgba(59,130,246,0.1)",
                color: "var(--sapphire)",
              }}
            >
              <Activity size={20} />
            </div>
          </div>
          <div className="stat-value">
            {metrics?.todayTransactionsCount ?? 0}
          </div>
          <div className="stat-footer">
            ₹
            {(metrics?.todayVolumeRupees ?? 0).toLocaleString("en-IN")} total
            volume
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Pending KYC</span>
            <div
              className="stat-icon"
              style={{
                background: "rgba(245,158,11,0.1)",
                color: "var(--amber)",
              }}
            >
              <Users size={20} />
            </div>
          </div>
          <div className="stat-value">
            {metrics?.pendingKycCount ?? pendingKycCount}
          </div>
          <div className="stat-footer">Awaiting document review</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Pending Loans</span>
            <div
              className="stat-icon"
              style={{
                background: "rgba(59,130,246,0.1)",
                color: "var(--sapphire)",
              }}
            >
              <FileCheck size={20} />
            </div>
          </div>
          <div className="stat-value">
            {metrics?.pendingLoansCount ?? pendingLoansCount}
          </div>
          <div className="stat-footer">Under credit review</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Active Accounts</span>
            <div
              className="stat-icon"
              style={{
                background: "rgba(16,185,129,0.1)",
                color: "var(--emerald)",
              }}
            >
              <Landmark size={20} />
            </div>
          </div>
          <div className="stat-value">
            {metrics?.totalAccountsCount ?? 0}
          </div>
          <div className="stat-footer">
            {metrics?.totalCustomersCount ?? 0} registered customers
          </div>
        </div>
      </div>

      {/* Staff navigation */}
      <div
        className="staff-tab-list"
        role="tablist"
        aria-label="Staff operations sections"
        style={{
          display: "flex",
          gap: 10,
          borderBottom: "1px solid var(--border-subtle)",
          paddingBottom: 14,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        {(
          [
            { id: "live", label: "Live Activity", icon: Activity },
            { id: "teller", label: "Cash Teller Desk", icon: DollarSign },
            {
              id: "kyc",
              label: `KYC (${pendingKycCount})`,
              icon: Users,
            },
            {
              id: "loans",
              label: `Loans (${pendingLoansCount})`,
              icon: FileCheck,
            },
            { id: "credit-cards", label: `Credit Cards (${pendingCreditCardsCount})`, icon: CreditCard },
            { id: "accounts", label: "Accounts", icon: Landmark },
            { id: "customers", label: "Customers", icon: Users },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`btn staff-tab-button ${
                selected ? "btn-primary" : "btn-secondary"
              }`}
              onClick={() => handleTabChange(tab.id)}
            >
              <Icon size={16} />
              {tab.label}
              {tab.id === "live" && sseConnected && (
                <span className="live-dot" style={{ marginLeft: 2 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Live activity */}
      {activeTab === "live" && (
        <div
          className="staff-live-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 280px",
            gap: 20,
          }}
        >
          <div
            className="card-panel"
            style={{ padding: 0, overflow: "hidden" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-subtle)",
                background: "var(--surface-1)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <Activity size={18} color="var(--sapphire)" />
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  Customer Activity Stream
                </span>

                {sseConnected && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--emerald)",
                      background: "rgba(16,185,129,0.1)",
                      borderRadius: 6,
                      padding: "2px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span
                      className="live-dot"
                      style={{ width: 6, height: 6 }}
                    />
                    LIVE
                  </span>
                )}
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => void loadLiveActivity()}
                disabled={liveLoading}
              >
                <RefreshCw size={13} />
                Refresh
              </button>
            </div>

            <div
              ref={feedRef}
              style={{
                padding: 16,
                maxHeight: 560,
                overflowY: "auto",
              }}
            >
              {liveLoading && liveEvents.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "var(--text-muted)",
                  }}
                >
                  Loading activity…
                </div>
              ) : liveEvents.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: 40,
                    color: "var(--text-muted)",
                  }}
                >
                  <Activity
                    size={32}
                    style={{
                      opacity: 0.3,
                      display: "block",
                      margin: "0 auto 12px",
                    }}
                  />
                  <div>
                    No activity yet. Customer actions will appear here
                    when available.
                  </div>
                </div>
              ) : (
                liveEvents.map((event) => (
                  <LiveEventCard
                    key={event.id}
                    event={event}
                    isNew={newEventIds.has(event.id)}
                  />
                ))
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div className="card-panel">
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  marginBottom: 14,
                  color: "var(--text-main)",
                }}
              >
                Today's Breakdown
              </div>

              {[
                {
                  label: "Deposits",
                  count: metrics?.todayDepositsCount ?? 0,
                  color: "var(--emerald)",
                  icon: ArrowDownLeft,
                },
                {
                  label: "Withdrawals",
                  count: metrics?.todayWithdrawalsCount ?? 0,
                  color: "var(--amber)",
                  icon: ArrowUpRight,
                },
                {
                  label: "Transfers",
                  count: metrics?.todayTransfersCount ?? 0,
                  color: "var(--sapphire)",
                  icon: ArrowRightLeft,
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 7,
                          background: `${item.color}18`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: item.color,
                        }}
                      >
                        <Icon size={14} />
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--text-muted)",
                        }}
                      >
                        {item.label}
                      </span>
                    </div>

                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 15,
                        color: item.color,
                      }}
                    >
                      {item.count}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="card-panel">
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  marginBottom: 14,
                  color: "var(--text-main)",
                }}
              >
                Event Legend
              </div>

              {[
                { label: "Deposit", color: "var(--emerald)" },
                { label: "Withdrawal", color: "var(--amber)" },
                { label: "Transfer", color: "var(--sapphire)" },
                { label: "Loan Applied", color: "var(--amber)" },
                { label: "FD Opened", color: "var(--sapphire)" },
                { label: "Account Opened", color: "var(--emerald)" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: item.color,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            <div
              className="card-panel"
              style={{
                background: sseConnected
                  ? "rgba(16,185,129,0.06)"
                  : "rgba(239,68,68,0.06)",
                border: `1px solid ${
                  sseConnected ? "var(--emerald)" : "var(--rose)"
                }22`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                {sseConnected ? (
                  <Wifi size={16} color="var(--emerald)" />
                ) : (
                  <WifiOff size={16} color="var(--rose)" />
                )}

                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: sseConnected
                      ? "var(--emerald)"
                      : "var(--rose)",
                  }}
                >
                  {sseConnected
                    ? "Live Stream Active"
                    : "Stream Disconnected"}
                </span>
              </div>

              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {sseConnected
                  ? "Activity events are pushed in real time."
                  : "The live connection is unavailable. Try reconnecting."}
              </p>

              {!sseConnected && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{
                    marginTop: 10,
                    padding: "6px 14px",
                    fontSize: 12,
                  }}
                  onClick={connectSSE}
                >
                  <Wifi size={12} />
                  Reconnect
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cash teller desk */}
      {activeTab === "teller" && (
        <div
          className="staff-two-column-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: 24,
          }}
        >
          <div className="card-panel">
            <h2
              style={{
                fontSize: 17,
                fontWeight: 700,
                marginBottom: 18,
                color: "var(--text-main)",
              }}
            >
              Teller Cash Processing Window
            </h2>

            {tellerError && (
              <div
                role="alert"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  color: "var(--rose)",
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                {tellerError}
              </div>
            )}

            <form onSubmit={handleTellerDeposit}>
              <div className="form-group">
                <label className="form-label" htmlFor="teller-account">
                  Customer Account Number
                </label>
                <input
                  id="teller-account"
                  type="text"
                  placeholder="e.g. VB1002003001"
                  value={tellerAccNum}
                  onChange={(event) =>
                    setTellerAccNum(event.target.value)
                  }
                  autoComplete="off"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="teller-amount">
                  Cash Amount (₹)
                </label>
                <input
                  id="teller-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={tellerAmount}
                  onChange={(event) =>
                    setTellerAmount(event.target.value)
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="teller-remarks">
                  Staff Verification Remarks / Notes
                </label>
                <input
                  id="teller-remarks"
                  type="text"
                  placeholder="Enter transaction notes"
                  value={tellerRemarks}
                  onChange={(event) =>
                    setTellerRemarks(event.target.value)
                  }
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 14,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={tellerLoading}
                >
                  <ArrowDownLeft size={16} />
                  {tellerLoading
                    ? "Processing…"
                    : "Process Cash Deposit"}
                </button>

                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ flex: 1 }}
                  onClick={() => void handleTellerWithdraw()}
                  disabled={tellerLoading}
                >
                  <ArrowUpRight size={16} />
                  {tellerLoading
                    ? "Processing…"
                    : "Process Cash Withdrawal"}
                </button>
              </div>
            </form>
          </div>

          <div className="card-panel">
            <h3
              style={{
                fontSize: 15,
                fontWeight: 700,
                marginBottom: 14,
                color: "var(--text-main)",
              }}
            >
              Branch Teller Protocols
            </h3>

            <ul
              style={{
                color: "var(--text-muted)",
                fontSize: 13,
                lineHeight: 1.8,
                paddingLeft: 18,
              }}
            >
              <li>
                Verify customer identity before processing cash withdrawals.
              </li>
              <li>
                Confirm the account number and amount before submitting.
              </li>
              <li>
                Keep the transaction reference for reconciliation.
              </li>
              <li>
                Use the generated receipt to confirm transaction details.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* KYC review */}
      {activeTab === "kyc" && (
        <KycReviewView token={token} onToast={onToast} />
      )}

      {/* Loan review queue */}
      {activeTab === "loans" && (
        <div className="card-panel" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Loan Product</th>
                  <th>Amount &amp; Rate</th>
                  <th>Tenure &amp; EMI</th>
                  <th>Purpose</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th style={{ textAlign: "right" }}>Decision</th>
                </tr>
              </thead>

              <tbody>
                {allLoans.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        textAlign: "center",
                        padding: 32,
                        color: "var(--text-muted)",
                      }}
                    >
                      No loan applications submitted yet.
                    </td>
                  </tr>
                ) : (
                  allLoans.map((loan) => (
                    <tr key={loan.id}>
                      <td>
                        <div
                          style={{
                            fontWeight: 700,
                            color: "var(--text-main)",
                          }}
                        >
                          {loan.customer?.name || "Customer"}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-faint)",
                          }}
                        >
                          {loan.customer?.email || ""}
                        </div>
                      </td>

                      <td style={{ fontWeight: 600 }}>{loan.loanType}</td>

                      <td>
                        <div
                          style={{
                            fontWeight: 700,
                            color: "var(--text-main)",
                          }}
                        >
                          ₹{Number(loan.amount || 0).toLocaleString("en-IN")}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--sapphire)",
                          }}
                        >
                          {loan.interestRate}% p.a.
                        </div>
                      </td>

                      <td>
                        <div
                          style={{
                            fontWeight: 700,
                            color: "var(--emerald)",
                          }}
                        >
                          ₹
                          {Number(loan.emiAmount || 0).toLocaleString(
                            "en-IN"
                          )}
                          /mo
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-faint)",
                          }}
                        >
                          {loan.tenureMonths} Months
                        </div>
                      </td>

                      <td
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                        }}
                      >
                        {loan.purpose || "—"}
                      </td>

                      <td>
                        <span
                          className={`status-pill ${loan.status || "pending"}`}
                        >
                          {loan.status || "pending"}
                        </span>
                      </td>

                      <td>
                        <input
                          type="text"
                          aria-label={`Review notes for loan ${loan.id}`}
                          placeholder="Credit risk note..."
                          value={reviewNotes[loan.id] || ""}
                          onChange={(event) =>
                            setReviewNotes((previous) => ({
                              ...previous,
                              [loan.id]: event.target.value,
                            }))
                          }
                          style={{ padding: "6px 10px", fontSize: 12 }}
                          disabled={loan.status !== "pending"}
                        />
                      </td>

                      <td style={{ textAlign: "right" }}>
                        {loan.status === "pending" ? (
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() =>
                                void handleReviewLoan(loan.id, "approve")
                              }
                            >
                              <CheckCircle size={13} />
                              Approve
                            </button>

                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() =>
                                void handleReviewLoan(loan.id, "reject")
                              }
                            >
                              <XCircle size={13} />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--text-faint)",
                            }}
                          >
                            Reviewed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Credit card application review queue */}
      {activeTab === "credit-cards" && (
        <div className="card-panel" style={{ padding: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              padding: "18px 20px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--text-main)",
                }}
              >
                Credit Card Applications
              </h2>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                Review customer applications and approve or reject requests.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void loadCreditCardApplications()}
              disabled={loadingCreditCards}
            >
              <RefreshCw
                size={15}
                className={loadingCreditCards ? "spin" : ""}
              />
              Refresh Applications
            </button>
          </div>

          <div style={{ padding: 20 }}>
            <div className="staff-card-summary">
              <div className="staff-card-summary-icon">
                <CreditCard size={22} />
              </div>

              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginBottom: 4,
                  }}
                >
                  Pending Applications
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: "var(--text-main)",
                  }}
                >
                  {pendingCreditCardsCount}
                </div>
              </div>
            </div>

            {loadingCreditCards && creditCardApplications.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 40,
                  color: "var(--text-muted)",
                }}
              >
                <RefreshCw
                  size={24}
                  className="spin"
                  style={{ marginBottom: 10 }}
                />
                <div>Loading credit card applications...</div>
              </div>
            ) : creditCardApplications.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "44px 20px",
                  color: "var(--text-muted)",
                }}
              >
                <CreditCard
                  size={36}
                  style={{
                    opacity: 0.35,
                    display: "block",
                    margin: "0 auto 12px",
                  }}
                />
                <h3
                  style={{
                    fontSize: 16,
                    color: "var(--text-main)",
                    margin: "0 0 8px",
                  }}
                >
                  No credit card applications
                </h3>
                <p style={{ margin: 0, fontSize: 13 }}>
                  Customer applications will appear here when submitted.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Card</th>
                      <th>Customer ID</th>
                      <th>Requested Limit</th>
                      <th>Outstanding</th>
                      <th>Applied On</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Decision</th>
                    </tr>
                  </thead>

                  <tbody>
                    {creditCardApplications.map((application) => {
                      const isReviewing =
                        reviewingCardId === application.id;
                      const isPending = application.status === "pending";

                      return (
                        <tr key={application.id}>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <div
                                style={{
                                  width: 34,
                                  height: 26,
                                  borderRadius: 5,
                                  background:
                                    "linear-gradient(135deg, #1e3a8a, #3b82f6)",
                                  color: "#fff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                <CreditCard size={15} />
                              </div>
                              <span
                                style={{
                                  fontWeight: 700,
                                  fontFamily: "monospace",
                                  color: "var(--text-main)",
                                }}
                              >
                                {application.cardNumberMasked || "New application"}
                              </span>
                            </div>
                          </td>

                          <td
                            style={{
                              fontSize: 12,
                              color: "var(--text-muted)",
                              fontFamily: "monospace",
                            }}
                          >
                            {application.customerId || "—"}
                          </td>

                          <td
                            style={{
                              fontWeight: 700,
                              color: "var(--text-main)",
                            }}
                          >
                            {formatRupeesFromPaise(
                              application.requestedLimitPaise
                            )}
                          </td>

                          <td>
                            {formatRupeesFromPaise(
                              application.outstandingBalancePaise
                            )}
                          </td>

                          <td>
                            {application.createdAt &&
                            !Number.isNaN(
                              new Date(application.createdAt).getTime()
                            )
                              ? new Date(
                                  application.createdAt
                                ).toLocaleDateString("en-IN")
                              : "—"}
                          </td>

                          <td>
                            <span
                              className={`status-pill ${application.status}`}
                            >
                              {application.status}
                            </span>
                          </td>

                          <td style={{ textAlign: "right" }}>
                            {isPending ? (
                              <div className="staff-review-actions">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  disabled={isReviewing}
                                  onClick={() =>
                                    void handleReviewCreditCard(
                                      application,
                                      "approve"
                                    )
                                  }
                                >
                                  <CheckCircle size={13} />
                                  {isReviewing ? "Processing..." : "Approve"}
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-sm btn-danger"
                                  disabled={isReviewing}
                                  onClick={() =>
                                    void handleReviewCreditCard(
                                      application,
                                      "reject"
                                    )
                                  }
                                >
                                  <XCircle size={13} />
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "var(--text-faint)",
                                  textAlign: "right",
                                }}
                              >
                                {application.reviewNotes || "Reviewed"}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accounts directory */}
      {activeTab === "accounts" && (
        <div className="card-panel" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account Number</th>
                  <th>Customer Holder</th>
                  <th>Type</th>
                  <th>Available Balance</th>
                  <th>Daily Limit</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {allAccounts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        textAlign: "center",
                        padding: 32,
                        color: "var(--text-muted)",
                      }}
                    >
                      No bank accounts found.
                    </td>
                  </tr>
                ) : (
                  allAccounts.map((account) => (
                    <tr key={account.id}>
                      <td
                        className="text-mono"
                        style={{
                          fontWeight: 700,
                          color: "var(--sapphire)",
                        }}
                      >
                        {account.accountNumber}
                      </td>

                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {account.customer?.name || "Vault Customer"}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-faint)",
                          }}
                        >
                          {account.customer?.email || ""}
                        </div>
                      </td>

                      <td>
                        <span
                          className={`account-type-tag ${account.accountType || ""}`}
                        >
                          {account.accountType || "Standard"}
                        </span>
                      </td>

                      <td
                        style={{
                          fontWeight: 700,
                          color: "var(--text-main)",
                        }}
                      >
                        {formatRupeesFromPaise(account.balancePaise)}
                      </td>

                      <td className="text-mono" style={{ fontSize: 12 }}>
                        {formatRupeesFromPaise(
                          account.dailyLimitPaise ?? 5000000
                        )}
                      </td>

                      <td>
                        <span
                          className={`status-pill ${account.status || ""}`}
                        >
                          {account.status || "unknown"}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className={`btn btn-sm ${
                            account.status === "active"
                              ? "btn-danger"
                              : "btn-primary"
                          }`}
                          onClick={() =>
                            void handleToggleAccountFreeze(account)
                          }
                        >
                          {account.status === "active"
                            ? "Freeze Account"
                            : "Unfreeze"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer directory */}
      {activeTab === "customers" && (
        <CustomerDirectoryView token={token} />
      )}
    </div>
  );
};

export default StaffPortalView;
