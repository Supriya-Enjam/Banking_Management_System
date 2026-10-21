
import React, { useState, useEffect, useCallback } from "react";
import { Settings,
  Link,
  Shield,
  Users,
  Landmark,
  Activity,
  AlertTriangle,
  FileText,
  Download,
  RefreshCw,
  Search,
  Edit3,
  X,
  CheckCircle,
} from "lucide-react";
import { api, type AdminMetrics, type AuditLogItem } from "../services/api";
import { ManagementDashboardView } from "./ManagementDashboardView";

type AdminTab = "overview" | "customers" | "audit" | "reports";

interface AdminDashboardViewProps {
  token: string;
  onToast: (msg: string) => void;
  initialTab?: AdminTab;
}

interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: string;
  kycStatus: string;
  accountCount: number;
  totalBalanceRupees: number;
  dailyLimitRupees: number;
}

interface AccountDistributionItem {
  type: string;
  count: number;
  totalBalance: number;
}

interface CategoryTotal {
  category: string;
  amount: number;
}

interface LoanDistributionItem {
  type: string;
  amount: number;
}

interface AdminReports {
  accountDistribution?: AccountDistributionItem[];
  categoryTotals?: CategoryTotal[];
  loanDistribution?: LoanDistributionItem[];
}

const formatRupees = (amount: number, decimals = 0) =>
  `₹${(Number(amount) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

const formatDateTime = (value: string | number | Date) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN");
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  token,
  onToast,
  initialTab = "overview",
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [reports, setReports] = useState<AdminReports | null>(null);
  const [loading, setLoading] = useState(false);

  // Customer search and editing
  const [customerSearch, setCustomerSearch] = useState("");
  const [editingCustomer, setEditingCustomer] =
    useState<AdminCustomer | null>(null);
  const [editStatus, setEditStatus] = useState("active");
  const [editKyc, setEditKyc] = useState("pending");
  const [editLimit, setEditLimit] = useState(50000);
  const [editRole, setEditRole] = useState("customer");
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Audit log filter
  const [auditSeverity, setAuditSeverity] = useState("all");

  // Keep this component synchronized with App.tsx sidebar navigation.
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadAdminData = useCallback(async () => {
    if (!token) return;

    setLoading(true);

    try {
      const [metricsRes, customersRes, logsRes, reportsRes] =
        await Promise.all([
          api.getAdminMetrics(token),
          api.getAdminCustomers(token, customerSearch),
          api.getAdminAuditLogs(token, { severity: auditSeverity }),
          api.getAdminReports(token),
        ]);

      setMetrics(metricsRes.metrics);
      setCustomers(customersRes.customers || []);
      setAuditLogs(logsRes.logs || []);
      setReports(reportsRes.reports || null);
    } catch (error: unknown) {
      onToast(
        getErrorMessage(error, "Failed to load admin dashboard data.")
      );
    } finally {
      setLoading(false);
    }
  }, [token, customerSearch, auditSeverity, onToast]);

// Automatically refresh dashboard data every 15 seconds.
useEffect(() => {
  if (!token) return;

  const intervalId = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      void loadAdminData();
    }
  }, 15000);

  return () => {
    window.clearInterval(intervalId);
  };
}, [token, loadAdminData]);


  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  const openEditModal = (customer: AdminCustomer) => {
    setEditingCustomer(customer);
    setEditStatus(customer.status || "active");
    setEditKyc(customer.kycStatus || "pending");
    setEditLimit(customer.dailyLimitRupees ?? 50000);
    setEditRole(customer.role || "customer");
  };

  const handleSaveCustomer = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!editingCustomer) return;

    if (!Number.isFinite(editLimit) || editLimit < 1000) {
      onToast("Please enter a valid daily limit of at least ₹1,000.");
      return;
    }

    setSavingCustomer(true);

    try {
      await api.updateAdminCustomer(token, editingCustomer.id, {
        status: editStatus,
        kycStatus: editKyc,
        dailyLimitRupees: Number(editLimit),
        role: editRole,
      });

      onToast(`Customer ${editingCustomer.name} updated successfully.`);
      setEditingCustomer(null);

      await loadAdminData();
    } catch (error: unknown) {
      onToast(getErrorMessage(error, "Failed to update customer."));
    } finally {
      setSavingCustomer(false);
    }
  };

  const exportAuditCSV = () => {
    if (auditLogs.length === 0) {
      onToast("There are no audit logs to export.");
      return;
    }

    const headers = [
      "Timestamp",
      "User Name",
      "User Email",
      "Role",
      "Action",
      "Details",
      "Severity",
      "IP Address",
    ];

    const escapeCSV = (value: unknown) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const rows = auditLogs.map((log) =>
      [
        formatDateTime(log.createdAt),
        log.userName,
        log.userEmail,
        log.userRole,
        log.action,
        log.details,
        log.severity,
        log.ipAddress,
      ]
        .map(escapeCSV)
        .join(",")
    );

    const csvContent = [
      headers.map(escapeCSV).join(","),
      ...rows,
    ].join("\r\n");

    const blob = new Blob(["\uFEFF", csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `VaultBank_AuditLogs_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const tabs: {
    id: AdminTab;
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: "overview", label: "Executive Overview", icon: Landmark },
    {
      id: "customers",
      label: `Customer Accounts Manager (${customers.length})`,
      icon: Users,
    },
    {
      id: "audit",
      label: `Security & Audit Logs (${auditLogs.length})`,
      icon: AlertTriangle,
    },
    {
      id: "reports",
      label: "Financial Distribution Reports",
      icon: FileText,
    },
  ];

  return (
    <div className="admin-dashboard-view">
      {/* Page heading */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Executive Admin &amp; Risk Control
            <Link to="/management">
              <button className="btn btn-primary" style={{marginLeft: "12px"}}>
                Management Dashboard
              </button>
            </Link>
          </h1>
          <p className="page-subtitle">
            Core banking telemetry, customer lifecycle management, and
            audit logs
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void loadAdminData()}
          disabled={loading}
        >
          <RefreshCw
            size={16}
            className={loading ? "admin-spin" : ""}
          />
          {loading ? "Refreshing..." : "Refresh Telemetry"}
        </button>
      </div>

      {/* KPI cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total Bank Reserves</span>
            <div
              className="stat-icon"
              style={{
                background: "rgba(16, 185, 129, 0.1)",
                color: "var(--emerald)",
              }}
            >
              <Landmark size={20} />
            </div>
          </div>

          <div className="stat-value">
            {formatRupees(metrics?.totalReserves ?? 0, 2)}
          </div>

          <div className="stat-footer">
            Aggregate customer liquid balances
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Customer Accounts</span>
            <div
              className="stat-icon"
              style={{
                background: "rgba(59, 130, 246, 0.1)",
                color: "var(--sapphire)",
              }}
            >
              <Users size={20} />
            </div>
          </div>

          <div className="stat-value">
            {metrics?.totalCustomers ?? 0} Users
          </div>

          <div className="stat-footer">
            {metrics?.activeAccounts ?? 0} active bank accounts
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Disbursed Loans</span>
            <div
              className="stat-icon"
              style={{
                background: "rgba(245, 158, 11, 0.1)",
                color: "var(--amber)",
              }}
            >
              <Activity size={20} />
            </div>
          </div>

          <div className="stat-value">
            {formatRupees(metrics?.totalLoansDisbursed ?? 0)}
          </div>

          <div className="stat-footer">
            {metrics?.pendingLoansCount ?? 0} applications in pipeline
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Term Deposit Portfolio</span>
            <div
              className="stat-icon"
              style={{
                background: "rgba(99, 102, 241, 0.1)",
                color: "#a5b4fc",
              }}
            >
              <Shield size={20} />
            </div>
          </div>

          <div className="stat-value">
            {formatRupees(metrics?.totalFixedDeposits ?? 0)}
          </div>

          <div className="stat-footer">
            Locked high-yield reserves
          </div>
        </div>
      </div>

      {/* Admin tabs */}
      <div
        className="admin-dashboard-tabs"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          borderBottom: "1px solid var(--border-subtle)",
          paddingBottom: 14,
          marginBottom: 24,
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              className={`btn ${
                activeTab === tab.id ? "btn-primary" : "btn-secondary"
              }`}
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Executive overview */}
      {activeTab === "overview" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
            gap: 24,
          }}
        >
          <div className="card-panel">
            <h3 className="admin-section-title">
              Core Banking Health &amp; Telemetry
            </h3>

            <div className="admin-metric-list">
              <div className="admin-metric-row">
                <span>Total Core Accounts</span>
                <strong>{metrics?.totalAccounts ?? 0}</strong>
              </div>

              <div className="admin-metric-row">
                <span>Today's Transaction Volume</span>
                <strong style={{ color: "var(--emerald)" }}>
                  {formatRupees(metrics?.todayVolume ?? 0)}
                </strong>
              </div>

              <div className="admin-metric-row">
                <span>Total Transactions Processed</span>
                <strong>
                  {metrics?.totalTransactionsCount ?? 0} TXNs
                </strong>
              </div>

              <div className="admin-metric-row">
                <span>System Health Status</span>
                <strong style={{ color: "var(--emerald)" }}>
                  <CheckCircle
                    size={15}
                    style={{ verticalAlign: "middle" }}
                  />{" "}
                  Operational
                </strong>
              </div>
            </div>
          </div>

          <div className="card-panel">
            <h3 className="admin-section-title">
              Account Composition Breakdown
            </h3>

            <div className="admin-metric-list">
              {reports?.accountDistribution?.length ? (
                reports.accountDistribution.map((item) => {
                  const totalAccounts = metrics?.totalAccounts || 1;
                  const percentage = Math.min(
                    100,
                    Math.max(0, (item.count / totalAccounts) * 100)
                  );

                  return (
                    <div key={item.type}>
                      <div className="admin-distribution-header">
                        <span style={{ textTransform: "capitalize" }}>
                          {item.type} Accounts
                        </span>
                        <span className="text-mono">
                          {formatRupees(item.totalBalance)} ({item.count}{" "}
                          accts)
                        </span>
                      </div>

                      <div className="daily-limit-bar">
                        <div
                          className="daily-limit-fill"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="page-subtitle">
                  No account distribution data is available yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customer directory */}
      {activeTab === "customers" && (
        <div className="card-panel" style={{ padding: 0 }}>
          <div className="admin-toolbar">
            <div className="admin-search-box">
              <Search size={16} color="var(--text-faint)" />

              <input
                type="search"
                placeholder="Search user name or email..."
                aria-label="Search customers"
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void loadAdminData();
                  }
                }}
              />
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void loadAdminData()}
              disabled={loading}
            >
              <Search size={15} />
              Search
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Email &amp; Phone</th>
                  <th>Role</th>
                  <th>Account Holdings</th>
                  <th>Portfolio Balance</th>
                  <th>Daily Limit</th>
                  <th>KYC</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="admin-customer-name">
                        {customer.name}
                      </div>
                      <div className="admin-muted-small">
                        ID: {String(customer.id).slice(-6)}
                      </div>
                    </td>

                    <td>
                      <div>{customer.email}</div>
                      <div className="admin-muted-small">
                        {customer.phone || "—"}
                      </div>
                    </td>

                    <td>
                      <span className={`role-badge ${customer.role}`}>
                        {customer.role}
                      </span>
                    </td>

                    <td>{customer.accountCount ?? 0} Accounts</td>

                    <td className="admin-balance">
                      {formatRupees(
                        customer.totalBalanceRupees ?? 0,
                        2
                      )}
                    </td>

                    <td className="text-mono">
                      {formatRupees(customer.dailyLimitRupees ?? 0)}
                    </td>

                    <td>
                      <span
                        className={`status-pill ${
                          customer.kycStatus || "pending"
                        }`}
                      >
                        {customer.kycStatus || "pending"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`status-pill ${
                          customer.status || "active"
                        }`}
                      >
                        {customer.status || "active"}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => openEditModal(customer)}
                      >
                        <Edit3 size={13} />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}

                {!loading && customers.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="admin-empty-cell"
                    >
                      No customers found. Try another search.
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td colSpan={9} className="admin-empty-cell">
                      Loading customer records...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Security and audit logs */}
      {activeTab === "audit" && (
        <div className="card-panel" style={{ padding: 0 }}>
          <div className="admin-toolbar admin-toolbar-between">
            <div className="admin-filter-control">
              <label htmlFor="admin-audit-severity">Severity:</label>

              <select
                id="admin-audit-severity"
                value={auditSeverity}
                onChange={(event) => setAuditSeverity(event.target.value)}
              >
                <option value="all">All Events</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={exportAuditCSV}
            >
              <Download size={14} />
              Export Audit Log CSV
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User / Initiator</th>
                  <th>Action Event</th>
                  <th>Event Details</th>
                  <th>Severity</th>
                  <th>Client IP</th>
                </tr>
              </thead>

              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="admin-nowrap-small">
                      {formatDateTime(log.createdAt)}
                    </td>

                    <td>
                      <div className="admin-customer-name">
                        {log.userName || "System"}
                      </div>
                      <div className="admin-muted-small">
                        {log.userEmail || "—"}
                      </div>
                    </td>

                    <td>
                      <span className="admin-audit-action">
                        {log.action}
                      </span>
                    </td>

                    <td className="admin-audit-details">
                      {log.details}
                    </td>

                    <td>
                      <span
                        className={`status-pill admin-severity-${String(
                          log.severity || "info"
                        ).toLowerCase()}`}
                      >
                        {log.severity || "info"}
                      </span>
                    </td>

                    <td className="admin-ip-address">
                      {log.ipAddress || "—"}
                    </td>
                  </tr>
                ))}

                {!loading && auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="admin-empty-cell">
                      No audit events match this filter.
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td colSpan={6} className="admin-empty-cell">
                      Loading audit events...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Financial reports */}
      {activeTab === "reports" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
            gap: 24,
          }}
        >
          <div className="card-panel">
            <h3 className="admin-section-title">
              Transaction Volume by Category
            </h3>

            <div className="admin-metric-list">
              {reports?.categoryTotals?.length ? (
                reports.categoryTotals.map((category) => (
                  <div
                    key={category.category}
                    className="admin-report-row"
                  >
                    <span>{category.category}</span>
                    <span className="admin-report-amount">
                      {formatRupees(category.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="page-subtitle">
                  No transaction category data is available.
                </p>
              )}
            </div>
          </div>

          <div className="card-panel">
            <h3 className="admin-section-title">
              Loan Portfolio Exposure
            </h3>

            <div className="admin-metric-list">
              {reports?.loanDistribution?.length ? (
                reports.loanDistribution.map((loan) => (
                  <div key={loan.type} className="admin-report-row">
                    <span>{loan.type} Financing</span>
                    <span className="admin-report-amount admin-loan-amount">
                      {formatRupees(loan.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="page-subtitle">
                  No loan distribution data is available.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit customer modal */}
      {editingCustomer && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!savingCustomer) setEditingCustomer(null);
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-edit-customer-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <span
                className="modal-title"
                id="admin-edit-customer-title"
              >
                Edit User Profile &amp; Compliance
              </span>

              <button
                type="button"
                className="icon-btn"
                aria-label="Close edit dialog"
                disabled={savingCustomer}
                onClick={() => setEditingCustomer(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer}>
              <div className="modal-body">
                <div style={{ marginBottom: 16 }}>
                  <strong>{editingCustomer.name}</strong>{" "}
                  <span>({editingCustomer.email})</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="admin-edit-role">
                    System Role
                  </label>
                  <select
                    id="admin-edit-role"
                    value={editRole}
                    onChange={(event) => setEditRole(event.target.value)}
                  >
                    <option value="customer">Customer</option>
                    <option value="staff">Bank Staff Officer</option>
                    <option value="management">Management</option>
                    <option value="admin">System Administrator</option>
                  </select>
                </div>

                <div className="form-group">
                  <label
                    className="form-label"
                    htmlFor="admin-edit-status"
                  >
                    Account Status
                  </label>
                  <select
                    id="admin-edit-status"
                    value={editStatus}
                    onChange={(event) => setEditStatus(event.target.value)}
                  >
                    <option value="active">Active (Normal Access)</option>
                    <option value="frozen">Frozen (Compliance Hold)</option>
                    <option value="blocked">Blocked (Suspended Access)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="admin-edit-kyc">
                    KYC Verification Status
                  </label>
                  <select
                    id="admin-edit-kyc"
                    value={editKyc}
                    onChange={(event) => setEditKyc(event.target.value)}
                  >
                    <option value="verified">Verified</option>
                    <option value="pending">Pending Review</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="form-group">
                  <label
                    className="form-label"
                    htmlFor="admin-edit-limit"
                  >
                    Daily Transaction Limit (₹)
                  </label>
                  <input
                    id="admin-edit-limit"
                    type="number"
                    min="1000"
                    step="1000"
                    value={editLimit}
                    onChange={(event) =>
                      setEditLimit(Number(event.target.value))
                    }
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingCustomer(null)}
                  disabled={savingCustomer}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingCustomer}
                >
                  {savingCustomer ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardView;
