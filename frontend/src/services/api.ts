const API_BASE_URL = "http://localhost:5000/api";

// =========================================================
// TYPES
// =========================================================

export interface Customer {
  id: string;
  name: string;
  email: string;
  role: "customer" | "staff" | "admin";
  phone?: string;
  address?: string;
  kycStatus?: "verified" | "pending" | "rejected";
  dailyLimitRupees?: number;
  createdAt?: string;
}

export interface BankAccount {
  id: string;
  accountNumber: string;
  accountType: "savings" | "current" | "business";
  balancePaise: number;
  dailyLimitPaise: number;
  currency: "INR";
  status: "active" | "frozen" | "closed";
  createdAt: string;
  customer?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    kycStatus?: string;
  };
}

export interface BankTransaction {
  id: string;
  accountId: string;
  accountNumber?: string;
  accountType?: string;
  reference: string;
  type:
    | "deposit"
    | "withdrawal"
    | "transfer"
    | "loan_disbursement"
    | "loan_repayment"
    | "fd_creation"
    | "fd_liquidation";
  category?: string;
  amountPaise: number;
  amount: number;
  currency: string;
  description: string;
  recipientDetails?: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
  account?: {
    accountNumber: string;
    customerName: string;
    customerEmail?: string;
  };
}

export interface Beneficiary {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  nickname: string;
  maxLimitRupees: number;
  createdAt: string;
}

export interface Loan {
  id: string;
  loanType: "Personal" | "Home" | "Vehicle" | "Education" | "Business";
  amount: number;
  amountPaise: number;
  interestRate: number;
  tenureMonths: number;
  emiAmount: number;
  emiPaise: number;
  remainingAmount: number;
  remainingAmountPaise: number;
  paidEmis: number;
  purpose: string;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "disbursed"
    | "closed";
  accountNumber?: string;
  reviewNotes?: string;
  customer?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    kycStatus?: string;
  };
  createdAt: string;
}

export interface FixedDeposit {
  id: string;
  depositNumber: string;
  accountNumber: string;
  amount: number;
  amountPaise: number;
  tenureMonths: number;
  interestRate: number;
  maturityAmount: number;
  maturityAmountPaise: number;
  startDate: string;
  maturityDate: string;
  status: "active" | "matured" | "liquidated";
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "transaction" | "security" | "loan" | "system";
  read: boolean;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  userName: string;
  userEmail: string;
  userRole: string;
  action: string;
  details: string;
  severity: "info" | "warning" | "critical";
  ipAddress: string;
  createdAt: string;
}

export interface AdminMetrics {
  totalCustomers: number;
  activeAccounts: number;
  totalAccounts: number;
  totalReserves: number;
  totalLoansDisbursed: number;
  pendingLoansCount: number;
  totalFixedDeposits: number;
  todayVolume: number;
  totalTransactionsCount: number;
}

export interface StaffMetrics {
  pendingKycCount: number;
  pendingLoansCount: number;
  totalAccountsCount: number;
  totalCustomersCount: number;
  todayTransactionsCount: number;
  todayVolumeRupees: number;
  todayWithdrawalsCount: number;
  todayTransfersCount: number;
  todayDepositsCount: number;
  activeStaffStreamClients: number;
}

export interface ActiveSession {
  sessionId: string;
  userAgent: string;
  ipAddress: string;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface ActiveSessionsResponse {
  success: boolean;
  sessions: ActiveSession[];
}

// =========================================================
// AUTHENTICATION RESPONSE TYPES
// =========================================================

export interface AuthChallengeResponse {
  success: true;
  requiresTwoFactor: true;
  challengeId: string;
  expiresIn: number;
  maskedEmail?: string;
  message?: string;
}

export interface AuthSuccessResponse {
  success: true;
  requiresTwoFactor?: false;
  token: string;
  expiresIn: number;
  customer: Customer;
}

export type AuthResponse = AuthChallengeResponse | AuthSuccessResponse;

export interface ApiMessageResponse {
  success: boolean;
  message: string;
}

// =========================================================
// COMMON API REQUEST HELPER
// =========================================================

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    [key: string]: unknown;
  };

  if (!response.ok || data.success === false) {
    throw new Error(
      data.message || `Request failed with status ${response.status}`
    );
  }

  return data as T;
}

// =========================================================
// API METHODS
// =========================================================

export const api = {
  // -------------------------------------------------------
  // DEMO ACCOUNTS
  // -------------------------------------------------------

  getDemoUsers() {
    return request<{
      success: boolean;
      users: Array<{
        role: string;
        label: string;
        email: string;
        password: string;
        description: string;
      }>;
    }>("/auth/demo-users");
  },

  // -------------------------------------------------------
  // AUTHENTICATION
  // -------------------------------------------------------

  login(email: string, password: string) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  googleLogin(idToken: string) {
    return request<AuthResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
  },

  verifyLoginOtp(challengeId: string, otp: string) {
    return request<AuthSuccessResponse>("/auth/verify-login-otp", {
      method: "POST",
      body: JSON.stringify({ challengeId, otp }),
    });
  },

  register(data: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    phone?: string;
    address?: string;
    role?: string;
  }) {
    return request<{
      success: boolean;
      message: string;
      customer: Customer;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getMe(token: string) {
    return request<{ success: boolean; customer: Customer }>(
      "/auth/me",
      {},
      token
    );
  },

  updateProfile(
    token: string,
    data: { name?: string; phone?: string; address?: string }
  ) {
    return request<{ success: boolean; message: string; customer: Customer }>(
      "/auth/profile",
      { method: "PUT", body: JSON.stringify(data) },
      token
    );
  },

  changePassword(
    token: string,
    data: { currentPassword: string; newPassword: string }
  ) {
    return request<{ success: boolean; message: string }>(
      "/auth/change-password",
      { method: "PUT", body: JSON.stringify(data) },
      token
    );
  },

  // -------------------------------------------------------
  // SESSION MANAGEMENT
  // -------------------------------------------------------

  getActiveSessions(token: string) {
    return request<ActiveSessionsResponse>("/auth/sessions", {}, token);
  },

  revokeSession(token: string, sessionId: string) {
    return request<ApiMessageResponse>(
      `/auth/sessions/${encodeURIComponent(sessionId)}`,
      { method: "DELETE" },
      token
    );
  },

  // -------------------------------------------------------
  // BANK ACCOUNTS
  // -------------------------------------------------------

  getAccounts(token: string) {
    return request<{ success: boolean; count: number; accounts: BankAccount[] }>(
      "/accounts",
      {},
      token
    );
  },

  createAccount(token: string, accountType: string, initialDeposit = 0) {
    return request<{ success: boolean; message: string; account: BankAccount }>(
      "/accounts",
      {
        method: "POST",
        body: JSON.stringify({ accountType, initialDeposit }),
      },
      token
    );
  },

  getAllAccounts(token: string) {
    return request<{ success: boolean; count: number; accounts: BankAccount[] }>(
      "/accounts/all",
      {},
      token
    );
  },

  updateAccountStatus(
    token: string,
    id: string,
    status?: string,
    dailyLimitRupees?: number
  ) {
    return request<{ success: boolean; message: string; account: any }>(
      `/accounts/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status, dailyLimitRupees }),
      },
      token
    );
  },

  // -------------------------------------------------------
  // TRANSACTIONS
  // -------------------------------------------------------

  getTransactions(
    token: string,
    params: {
      page?: number;
      limit?: number;
      type?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
      accountId?: string;
    } = {}
  ) {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    if (params.type && params.type !== "all") q.set("type", params.type);
    if (params.search) q.set("search", params.search);
    if (params.startDate) q.set("startDate", params.startDate);
    if (params.endDate) q.set("endDate", params.endDate);
    if (params.accountId) q.set("accountId", params.accountId);

    return request<{
      success: boolean;
      count: number;
      pagination: { page: number; limit: number; total: number; totalPages: number };
      transactions: BankTransaction[];
    }>(`/transactions?${q.toString()}`, {}, token);
  },

  deposit(
    token: string,
    accountId: string,
    amount: number,
    description?: string,
    category?: string
  ) {
    return request<{ success: boolean; message: string; transaction: any }>(
      "/transactions/deposit",
      {
        method: "POST",
        body: JSON.stringify({ accountId, amount, description, category }),
      },
      token
    );
  },

  withdraw(token: string, accountId: string, amount: number, description?: string) {
    return request<{ success: boolean; message: string; transaction: any }>(
      "/transactions/withdraw",
      {
        method: "POST",
        body: JSON.stringify({ accountId, amount, description }),
      },
      token
    );
  },

  transfer(
    token: string,
    data: {
      accountId: string;
      recipientAccountNumber: string;
      amount: number;
      description?: string;
      category?: string;
    }
  ) {
    return request<{ success: boolean; message: string; transaction: any }>(
      "/transactions/transfer",
      { method: "POST", body: JSON.stringify(data) },
      token
    );
  },

  getReceipt(token: string, reference: string) {
    return request<{ success: boolean; receipt: any }>(
      `/transactions/receipt/${encodeURIComponent(reference)}`,
      {},
      token
    );
  },

  getAllTransactions(
    token: string,
    params: {
      page?: number;
      limit?: number;
      type?: string;
      status?: string;
      search?: string;
    } = {}
  ) {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    if (params.type && params.type !== "all") q.set("type", params.type);
    if (params.status && params.status !== "all") q.set("status", params.status);
    if (params.search) q.set("search", params.search);

    return request<{
      success: boolean;
      count: number;
      pagination: { page: number; limit: number; total: number; totalPages: number };
      transactions: BankTransaction[];
    }>(`/transactions/all?${q.toString()}`, {}, token);
  },

  getTransactionStats(token: string) {
    return request<{ success: boolean; stats: any }>("/transactions/stats", {}, token);
  },

  // -------------------------------------------------------
  // BENEFICIARIES
  // -------------------------------------------------------

  getBeneficiaries(token: string) {
    return request<{ success: boolean; count: number; beneficiaries: Beneficiary[] }>(
      "/beneficiaries",
      {},
      token
    );
  },

  lookupAccount(token: string, accountNumber: string) {
    return request<{
      success: boolean;
      found: boolean;
      isInternal: boolean;
      customerName?: string;
      accountType?: string;
    }>(`/beneficiaries/lookup/${encodeURIComponent(accountNumber)}`, {}, token);
  },

  addBeneficiary(
    token: string,
    data: {
      name: string;
      accountNumber: string;
      bankName: string;
      ifscCode: string;
      nickname?: string;
      maxLimitRupees?: number;
    }
  ) {
    return request<{ success: boolean; message: string; beneficiary: Beneficiary }>(
      "/beneficiaries",
      { method: "POST", body: JSON.stringify(data) },
      token
    );
  },

  deleteBeneficiary(token: string, id: string) {
    return request<{ success: boolean; message: string }>(
      `/beneficiaries/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      token
    );
  },

  // -------------------------------------------------------
  // LOANS
  // -------------------------------------------------------

  calculateLoan(amountRupees: number, loanType: string, tenureMonths: number) {
    return request<{
      success: boolean;
      interestRate: number;
      monthlyEmiRupees: number;
      totalInterestRupees: number;
      totalRepaymentRupees: number;
    }>("/loans/calculate", {
      method: "POST",
      body: JSON.stringify({ amountRupees, loanType, tenureMonths }),
    });
  },

  applyLoan(
    token: string,
    data: {
      accountId: string;
      loanType: string;
      amountRupees: number;
      tenureMonths: number;
      purpose: string;
    }
  ) {
    return request<{ success: boolean; message: string; loan: any }>(
      "/loans/apply",
      { method: "POST", body: JSON.stringify(data) },
      token
    );
  },

  getMyLoans(token: string) {
    return request<{ success: boolean; count: number; loans: Loan[] }>(
      "/loans/my",
      {},
      token
    );
  },

  getAllLoans(token: string) {
    return request<{ success: boolean; count: number; loans: Loan[] }>(
      "/loans/all",
      {},
      token
    );
  },

  reviewLoan(
    token: string,
    id: string,
    action: "approve" | "reject",
    notes?: string
  ) {
    return request<{ success: boolean; message: string; loan: any }>(
      `/loans/${encodeURIComponent(id)}/review`,
      { method: "PATCH", body: JSON.stringify({ action, notes }) },
      token
    );
  },

  payLoanEmi(token: string, loanId: string) {
    return request<{ success: boolean; message: string; loan: any }>(
      `/loans/${encodeURIComponent(loanId)}/pay-emi`,
      { method: "POST" },
      token
    );
  },

  // -------------------------------------------------------
  // FIXED DEPOSITS
  // -------------------------------------------------------

  previewFd(amountRupees: number, tenureMonths: number) {
    return request<{
      success: boolean;
      interestRate: number;
      estimatedInterestRupees: number;
      maturityAmountRupees: number;
    }>("/fixed-deposits/preview", {
      method: "POST",
      body: JSON.stringify({ amountRupees, tenureMonths }),
    });
  },

  openFd(
    token: string,
    data: { accountId: string; amountRupees: number; tenureMonths: number }
  ) {
    return request<{ success: boolean; message: string; fixedDeposit: FixedDeposit }>(
      "/fixed-deposits/open",
      { method: "POST", body: JSON.stringify(data) },
      token
    );
  },

  getFixedDeposits(token: string) {
    return request<{ success: boolean; count: number; fixedDeposits: FixedDeposit[] }>(
      "/fixed-deposits",
      {},
      token
    );
  },

  liquidateFd(token: string, id: string) {
    return request<{ success: boolean; message: string; payoutAmountRupees: number }>(
      `/fixed-deposits/${encodeURIComponent(id)}/liquidate`,
      { method: "POST" },
      token
    );
  },

  // -------------------------------------------------------
  // NOTIFICATIONS
  // -------------------------------------------------------

  getNotifications(token: string) {
    return request<{
      success: boolean;
      unreadCount: number;
      notifications: NotificationItem[];
    }>("/notifications", {}, token);
  },

  markNotificationRead(token: string, id: string) {
    return request<{ success: boolean; message: string }>(
      `/notifications/${encodeURIComponent(id)}/read`,
      { method: "PATCH" },
      token
    );
  },

  markAllNotificationsRead(token: string) {
    return request<{ success: boolean; message: string }>(
      "/notifications/mark-all-read",
      { method: "POST" },
      token
    );
  },

  // -------------------------------------------------------
  // ADMIN
  // -------------------------------------------------------

  getAdminMetrics(token: string) {
    return request<{ success: boolean; metrics: AdminMetrics }>(
      "/admin/metrics",
      {},
      token
    );
  },

  getAdminCustomers(token: string, search?: string) {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return request<{ success: boolean; count: number; customers: any[] }>(
      `/admin/customers${query}`,
      {},
      token
    );
  },

  updateAdminCustomer(
    token: string,
    id: string,
    data: {
      status?: string;
      kycStatus?: string;
      dailyLimitRupees?: number;
      role?: string;
    }
  ) {
    return request<{ success: boolean; message: string; customer: any }>(
      `/admin/customers/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(data) },
      token
    );
  },

  getAdminAuditLogs(
    token: string,
    params: { severity?: string; action?: string; limit?: number } = {}
  ) {
    const q = new URLSearchParams();
    if (params.severity && params.severity !== "all") q.set("severity", params.severity);
    if (params.action && params.action !== "all") q.set("action", params.action);
    if (params.limit) q.set("limit", String(params.limit));

    return request<{ success: boolean; count: number; logs: AuditLogItem[] }>(
      `/admin/audit-logs?${q.toString()}`,
      {},
      token
    );
  },

  getAdminReports(token: string) {
    return request<{ success: boolean; reports: any }>("/admin/reports", {}, token);
  },

  // -------------------------------------------------------
  // STAFF
  // -------------------------------------------------------

  getStaffMetrics(token: string) {
    return request<{ success: boolean; metrics: StaffMetrics }>(
      "/staff/metrics",
      {},
      token
    );
  },

  getStaffKycCustomers(token: string) {
    return request<{ success: boolean; customers: any[] }>(
      "/staff/kyc-customers",
      {},
      token
    );
  },

  updateKycStatus(
    token: string,
    id: string,
    status: "verified" | "rejected",
    remarks?: string
  ) {
    return request<{ success: boolean; message: string; customer: any }>(
      `/staff/kyc/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ status, remarks }) },
      token
    );
  },

  tellerDeposit(
    token: string,
    data: { accountNumber: string; amountRupees: number; remarks?: string }
  ) {
    return request<{ success: boolean; message: string; transaction: any }>(
      "/staff/teller-deposit",
      { method: "POST", body: JSON.stringify(data) },
      token
    );
  },

  tellerWithdraw(
    token: string,
    data: { accountNumber: string; amountRupees: number; remarks?: string }
  ) {
    return request<{ success: boolean; message: string; transaction: any }>(
      "/staff/teller-withdraw",
      { method: "POST", body: JSON.stringify(data) },
      token
    );
  },

  getLiveActivity(token: string, limit = 30) {
    return request<{ success: boolean; count: number; activities: any[] }>(
      `/staff/live-activity?limit=${limit}`,
      {},
      token
    );
  },

  /**
   * EventSource cannot attach a custom Authorization header.
   * This requires the backend to explicitly support token query parameters.
   * Avoid query-token authentication unless the endpoint requires it, because
   * URLs may be recorded in logs and browser history.
   */
  createLiveStream(token: string): EventSource {
    return new EventSource(
      `${API_BASE_URL}/staff/live-stream?token=${encodeURIComponent(token)}`
    );
  },

  getStaffCustomers(
    token: string,
    params: { search?: string; status?: string; kycStatus?: string } = {}
  ) {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.status && params.status !== "all") q.set("status", params.status);
    if (params.kycStatus && params.kycStatus !== "all") q.set("kycStatus", params.kycStatus);

    return request<{ success: boolean; count: number; customers: any[] }>(
      `/staff/customers?${q.toString()}`,
      {},
      token
    );
  },
};
