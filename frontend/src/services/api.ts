
const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

// =========================================================
// TYPES
// =========================================================

export interface Customer {
  id: string;
  name: string;
  email: string;
  role: "customer" | "staff" | "management" | "admin";
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
    | "atm_withdrawal"
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
  documents?: {
  id: string;
  documentType: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}[];
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


export interface StaffEmployee {
  id: string;
  name: string;
  email: string;
  role: "staff" | "management" | "admin";
  employeeId: string | null;
  phone: string;
  status: string;
  createdAt: string;
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
// CREDIT CARD TYPES
// =========================================================

export type CreditCardStatus =
  | "pending"
  | "active"
  | "blocked"
  | "rejected"
  | "closed";

export interface CreditCard {
  id: string;
  cardNumberMasked: string;
  creditLimitPaise: number;
  outstandingBalancePaise: number;
  availableCreditPaise: number;
  status: CreditCardStatus;
  expiryMonth: number;
  expiryYear: number;
  billingDay: number;
  paymentDueDate: string | null;
  activatedAt: string | null;
  blockedAt: string | null;
  createdAt: string;
}

export type CreditCardTransactionType =
  | "credit_card_purchase"
  | "credit_card_repayment";

export interface CreditCardTransaction {
  id: string;
  reference: string;
  type: CreditCardTransactionType;
  category: string;
  amountPaise: number;
  amountRupees: number;
  description: string;
  merchant: string;
  status: "pending" | "completed" | "failed";
  createdAt: string;
}

export interface CreditCardsResponse {
  success: boolean;
  count: number;
  cards: CreditCard[];
}

export type CreditCardApplicationStatus =
  | "pending"
  | "active"
  | "rejected";

export interface CreditCardApplication {
  id: string;
  cardNumberMasked: string;
  requestedLimitPaise: number;
  outstandingBalancePaise?: number;
  status: CreditCardApplicationStatus;
  reviewNotes?: string;
  customerId?: string;
  createdAt: string;
}

export interface CreditCardApplicationResponse {
  success: boolean;
  message: string;
  card: CreditCardApplication;
}

export interface CreditCardApplicationsResponse {
  success: boolean;
  count: number;
  applications: CreditCardApplication[];
}

export interface CreditCardTransactionsResponse {
  success: boolean;
  card: {
    id: string;
    cardNumberMasked: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  count: number;
  transactions: CreditCardTransaction[];
}

// =========================================================
// DEBIT CARD TYPES
// =========================================================

export type DebitCardStatus =
  | "pending"
  | "active"
  | "blocked"
  | "expired";

export interface DebitCard {
  id: string;
  accountId: string;
  cardNumberMasked: string;
  status: DebitCardStatus;
  expiryMonth: number;
  expiryYear: number;
  atmDailyLimitPaise: number;
  createdAt: string;
  activatedAt: string | null;
  blockedAt: string | null;
}

export interface DebitCardsResponse {
  success: boolean;
  count: number;
  cards: DebitCard[];
}

export interface DebitCardRequestResponse {
  success: boolean;
  message?: string;
  card: DebitCard;
  cardNumber?: string;
}

export interface DebitCardActionResponse {
  success: boolean;
  message?: string;
  card?: DebitCard;
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

export class ApiError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number
  ) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

// Legacy token args remain temporarily for call-site compatibility and are never transmitted.


  
async function request<T>(
  path: string,
  options: RequestInit = {},
  _legacyToken?: string
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body instanceof FormData) {
    // The browser sets the multipart boundary automatically.
    headers.delete("Content-Type");
  } else if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  const data = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    [key: string]: unknown;
  };

  if (!response.ok || data.success === false) {
    throw new ApiError(
      typeof data.message === "string"
        ? data.message
        : `Request failed with status ${response.status}`,
      response.status
    );
  }

  return data as T;
}


export type AccountOpeningStatus = "pending" | "approved" | "rejected";

export type AccountOpeningDocumentType =
  | "identity"
  | "address"
  | "photo"
  | "business_registration";


export type DocumentVerificationStatus =
  | "pending"
  | "readable"
  | "unreadable"
  | "manual_review";


export type DocumentAuthenticityStatus =
  | "pending"
  | "verified"
  | "rejected";

export interface AccountOpeningDocument {
  id: string;
  documentType: AccountOpeningDocumentType;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  verificationStatus: DocumentVerificationStatus;
  analysisMessage: string;
  analyzedAt: string | null;
  authenticityStatus?: DocumentAuthenticityStatus;
  authenticityMessage?: string;
  authenticityVerifiedAt?: string | null;
  authenticityVerifiedBy?: string | null;
}

export interface AccountOpeningApplicantDetails {
  fullName: string;
  dateOfBirth: string;
  email: string;
  mobileNumber: string;
  residentialAddress: string;
}

export interface AccountOpeningRequirements {
  maxDocumentSizeBytes: number;
  maxDocumentCount: number;
  acceptedMimeTypes: string[];
}

export interface AccountOpeningApplication {
  id: string;
  applicantDetails?: AccountOpeningApplicantDetails | null;
  customer?: {
    id: string;
    name: string;
    email: string;
  };
  accountType: "savings" | "current" | "business";
  initialDepositPaise: number;
  status: AccountOpeningStatus;
  reviewRemarks: string;
  reviewedAt: string | null;
  accountId: string | null;
  documents: AccountOpeningDocument[];
  createdAt: string;
  updatedAt: string;
}



export interface StaffAccountOpeningApplication {
  id: string;
  customerId: string;
  accountType: "savings" | "current" | "business";
  requestedAccountType?: "savings" | "current" | "business";
  initialDepositPaise: number;
  status: AccountOpeningStatus;
  applicantDetails?: AccountOpeningApplicantDetails | null;
  reviewRemarks?: string;
  createdAt: string;
  reviewedAt?: string | null;
  accountId?: string | null;
  customer?: {
    name?: string;
    email?: string;
  };
   documents: AccountOpeningDocument[];
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

  logout() {
    return request<ApiMessageResponse>("/auth/logout", {
      method: "POST",
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
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
      token
    );
  },

  changePassword(
    token: string,
    data: { currentPassword: string; newPassword: string }
  ) {
    return request<{ success: boolean; message: string }>(
      "/auth/change-password",
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
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
    return request<{
      success: boolean;
      count: number;
      accounts: BankAccount[];
    }>("/accounts", {}, token);
  },

  createAccount(token: string, accountType: string, initialDeposit = 0) {
    return request<{
      success: boolean;
      message: string;
      account: BankAccount;
    }>(
      "/accounts",
      {
        method: "POST",
        body: JSON.stringify({ accountType, initialDeposit }),
      },
      token
    );
  },

  getAllAccounts(token: string) {
    return request<{
      success: boolean;
      count: number;
      accounts: BankAccount[];
    }>("/accounts/all", {}, token);
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
  // ACCOUNT-OPENING APPLICATIONS
  // -------------------------------------------------------

  submitAccountOpeningApplication(
    token: string,
    data: {
      accountType: "savings" | "current" | "business";
      initialDeposit: number;
      applicantDetails: AccountOpeningApplicantDetails;
      documents: Array<{
        documentType: AccountOpeningDocumentType;
        file: File;
      }>;
    }
  ) {
    const formData = new FormData();

    formData.append("accountType", data.accountType);
    formData.append("initialDeposit", String(data.initialDeposit));
    formData.append("fullName", data.applicantDetails.fullName);
    formData.append("dateOfBirth", data.applicantDetails.dateOfBirth);
    formData.append("email", data.applicantDetails.email);
    formData.append("mobileNumber", data.applicantDetails.mobileNumber);
    formData.append(
      "residentialAddress",
      data.applicantDetails.residentialAddress
    );

    formData.append(
      "documentTypes",
      JSON.stringify(data.documents.map((document) => document.documentType))
    );

    data.documents.forEach(({ file }) => {
      formData.append("documents", file);
    });

    return request<{
      success: boolean;
      message: string;
      application: AccountOpeningApplication;
    }>(
      "/account-opening",
      {
        method: "POST",
        body: formData,
      },
      token
    );
  },

  getAccountOpeningRequirements(token: string) {
    return request<
      { success: boolean } & AccountOpeningRequirements
    >("/account-opening/requirements", {}, token);
  },

  getAccountOpeningApplications(token: string) {
    return request<{
      success: boolean;
      count: number;
      applications: AccountOpeningApplication[];
    }>("/account-opening", {}, token);
  },

  getStaffAccountOpeningDocumentUrl(
    applicationId: string,
    documentId: string
  ) {
    return `${API_BASE_URL}/staff/account-opening/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(documentId)}`;
  },

getStaffAccountOpeningApplications(
  token: string,
  status: "pending" | "approved" | "rejected" = "pending"
) {
  return request<{
    success: boolean;
    count: number;
    applications: StaffAccountOpeningApplication[];
  }>(
    `/staff/account-opening?status=${status}`,
    {},
    token
  );
},

reviewAccountOpeningApplication(
  token: string,
  applicationId: string,
  decision: "approved" | "rejected",
  remarks: string
) {
  return request<{
    success: boolean;
    message: string;
    application?: StaffAccountOpeningApplication;
    account?: BankAccount;
  }>(
    `/staff/account-opening/${applicationId}/review`,
    {
      method: "PATCH",
      body: JSON.stringify({ decision, remarks }),
    },
    token
  );
},

  verifyAccountOpeningDocument(
    token: string,
    applicationId: string,
    documentId: string,
    decision: "verified" | "rejected",
    remarks: string
  ) {
    return request<{
      success: boolean;
      message: string;
      application: StaffAccountOpeningApplication;
    }>(
      `/staff/account-opening/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(documentId)}/verify`,
      {
        method: "PATCH",
        body: JSON.stringify({ decision, remarks }),
      },
      token
    );
  },


  // -------------------------------------------------------
  // DEBIT CARDS
  // -------------------------------------------------------

  getDebitCards(token: string) {
    return request<DebitCardsResponse>("/cards/debit", {}, token);
  },

  requestDebitCard(token: string, accountId: string, pin: string) {
    return request<DebitCardRequestResponse>(
      "/cards/debit/request",
      {
        method: "POST",
        body: JSON.stringify({ accountId, pin }),
      },
      token
    );
  },

  activateDebitCard(
    token: string,
    cardId: string,
    cardNumber: string,
    pin: string
  ) {
    return request<DebitCardActionResponse>(
      `/cards/debit/${encodeURIComponent(cardId)}/activate`,
      {
        method: "PATCH",
        body: JSON.stringify({ cardNumber, pin }),
      },
      token
    );
  },

  blockDebitCard(token: string, cardId: string) {
    return request<DebitCardActionResponse>(
      `/cards/debit/${encodeURIComponent(cardId)}/block`,
      { method: "PATCH" },
      token
    );
  },

  cancelDebitCard(token: string, cardId: string) {
    return request<DebitCardActionResponse>(
      `/cards/debit/${encodeURIComponent(cardId)}/cancel`,
      { method: "PATCH" },
      token
    );
  },

  // -------------------------------------------------------
  // CREDIT CARDS
  // -------------------------------------------------------

  getCreditCards(token: string) {
    return request<CreditCardsResponse>("/cards/credit", {}, token);
  },

  applyForCreditCard(
    token: string,
    requestedLimitRupees: number
  ) {
    return request<CreditCardApplicationResponse>(
      "/cards/credit/apply",
      {
        method: "POST",
        body: JSON.stringify({ requestedLimitRupees }),
      },
      token
    );
  },

  
  getCreditCardApplications(token: string) {
    return request<CreditCardApplicationsResponse>(
      "/cards/credit/applications",
      {},
      token
    );
  },

  reviewCreditCardApplication(
    token: string,
    cardId: string,
    decision: "approve" | "reject",
    approvedLimitRupees?: number
  ) {
    return request<{
      success: boolean;
      message: string;
      card: {
        id: string;
        status: CreditCardApplicationStatus;
        cardNumberMasked?: string;
        creditLimitPaise?: number;
        outstandingBalancePaise?: number;
        availableCreditPaise?: number;
        expiryMonth?: number;
        expiryYear?: number;
        activatedAt?: string;
      };
    }>(
      `/cards/credit/applications/${encodeURIComponent(cardId)}/review`,
      {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          ...(decision === "approve" && approvedLimitRupees !== undefined
            ? { approvedLimitRupees }
            : {}),
        }),
      },
      token
    );
  },


  getCreditCardTransactions(
    token: string,
    cardId: string,
    params: {
      page?: number;
      limit?: number;
      type?: "all" | "purchase" | "repayment";
    } = {}
  ) {
    const q = new URLSearchParams();

    if (params.page !== undefined) {
      q.set("page", String(params.page));
    }

    if (params.limit !== undefined) {
      q.set("limit", String(params.limit));
    }

    if (params.type && params.type !== "all") {
      q.set("type", params.type);
    }

    const query = q.toString();

    return request<CreditCardTransactionsResponse>(
      `/cards/credit/${encodeURIComponent(cardId)}/transactions${
        query ? `?${query}` : ""
      }`,
      {},
      token
    );
  },

  blockCreditCard(token: string, cardId: string) {
    return request<{
      success: boolean;
      message: string;
      card: {
        id: string;
        cardNumberMasked: string;
        status: CreditCardStatus;
        blockedAt: string | null;
      };
    }>(
      `/cards/credit/${encodeURIComponent(cardId)}/block`,
      { method: "PATCH" },
      token
    );
  },

  
  purchaseCreditCard(
    token: string,
    cardId: string,
    data: {
      amount: number;
      merchant?: string;
      description?: string;
    }
  ) {
    return request<{
      success: boolean;
      message: string;
      transaction: {
        transactionId: string;
        reference: string;
        amountPaise: number;
        remainingOutstandingPaise: number;
        availableCreditPaise: number;
      };
    }>(
      `/cards/credit/${encodeURIComponent(cardId)}/purchase`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      token
    );
  },

  repayCreditCard(
    token: string,
    cardId: string,
    data: {
      accountId: string;
      amount: number;
    }
  ) {
    return request<{
      success: boolean;
      message: string;
      transaction: {
        transactionId: string;
        reference: string;
        amountPaise: number;
        remainingOutstandingPaise: number;
        bankBalancePaise: number;
      };
    }>(
      `/cards/credit/${encodeURIComponent(cardId)}/repay`,
      {
        method: "POST",
        body: JSON.stringify(data),
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
    if (params.type && params.type !== "all") {
      q.set("type", params.type);
    }
    if (params.search) q.set("search", params.search);
    if (params.startDate) q.set("startDate", params.startDate);
    if (params.endDate) q.set("endDate", params.endDate);
    if (params.accountId) q.set("accountId", params.accountId);

    return request<{
      success: boolean;
      count: number;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
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

  withdraw(
    token: string,
    accountId: string,
    amount: number,
    description?: string
  ) {
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
      {
        method: "POST",
        body: JSON.stringify(data),
      },
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
    if (params.type && params.type !== "all") {
      q.set("type", params.type);
    }
    if (params.status && params.status !== "all") {
      q.set("status", params.status);
    }
    if (params.search) q.set("search", params.search);

    return request<{
      success: boolean;
      count: number;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
      transactions: BankTransaction[];
    }>(`/transactions/all?${q.toString()}`, {}, token);
  },

  getTransactionStats(token: string) {
    return request<{ success: boolean; stats: any }>(
      "/transactions/stats",
      {},
      token
    );
  },

  // -------------------------------------------------------
  // BENEFICIARIES
  // -------------------------------------------------------

  getBeneficiaries(token: string) {
    return request<{
      success: boolean;
      count: number;
      beneficiaries: Beneficiary[];
    }>("/beneficiaries", {}, token);
  },

  lookupAccount(token: string, accountNumber: string) {
    return request<{
      success: boolean;
      found: boolean;
      isInternal: boolean;
      customerName?: string;
      accountType?: string;
    }>(
      `/beneficiaries/lookup/${encodeURIComponent(accountNumber)}`,
      {},
      token
    );
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
    return request<{
      success: boolean;
      message: string;
      beneficiary: Beneficiary;
    }>(
      "/beneficiaries",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
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
      documents?: File[];
    }
  ) {
    const formData = new FormData();

    formData.append("accountId", data.accountId);
    formData.append("loanType", data.loanType);
    formData.append("amountRupees", String(data.amountRupees));
    formData.append("tenureMonths", String(data.tenureMonths));
    formData.append("purpose", data.purpose);

    (data.documents || []).forEach((file) => {
      formData.append("documents", file);
    });

    return request<{ success: boolean; message: string; loan: any }>(
      "/loans/apply",
      {
        method: "POST",
        body: formData,
      },
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

  
  downloadLoanDocument(
    token: string,
    loanId: string,
    documentId: string,
    fileName: string
  ): Promise<void> {
    return (async () => {
      const response = await fetch(
        `${API_BASE_URL}/loans/${encodeURIComponent(loanId)}/documents/${encodeURIComponent(documentId)}/download`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : "Failed to download document."
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    })();
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
      {
        method: "PATCH",
        body: JSON.stringify({ action, notes }),
      },
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
    data: {
      accountId: string;
      amountRupees: number;
      tenureMonths: number;
    }
  ) {
    return request<{
      success: boolean;
      message: string;
      fixedDeposit: FixedDeposit;
    }>(
      "/fixed-deposits/open",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      token
    );
  },

  getFixedDeposits(token: string) {
    return request<{
      success: boolean;
      count: number;
      fixedDeposits: FixedDeposit[];
    }>("/fixed-deposits", {}, token);
  },

  liquidateFd(token: string, id: string) {
    return request<{
      success: boolean;
      message: string;
      payoutAmountRupees: number;
    }>(
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
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
      token
    );
  },

  getAdminAuditLogs(
    token: string,
    params: { severity?: string; action?: string; limit?: number } = {}
  ) {
    const q = new URLSearchParams();

    if (params.severity && params.severity !== "all") {
      q.set("severity", params.severity);
    }
    if (params.action && params.action !== "all") {
      q.set("action", params.action);
    }
    if (params.limit) q.set("limit", String(params.limit));

    return request<{ success: boolean; count: number; logs: AuditLogItem[] }>(
      `/admin/audit-logs?${q.toString()}`,
      {},
      token
    );
  },

  getAdminReports(token: string) {
    return request<{ success: boolean; reports: any }>(
      "/admin/reports",
      {},
      token
    );
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
      {
        method: "PATCH",
        body: JSON.stringify({ status, remarks }),
      },
      token
    );
  },

  tellerDeposit(
    token: string,
    data: {
      accountNumber: string;
      amountRupees: number;
      remarks?: string;
    }
  ) {
    return request<{ success: boolean; message: string; transaction: any }>(
      "/staff/teller-deposit",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      token
    );
  },

  tellerWithdraw(
    token: string,
    data: {
      accountNumber: string;
      amountRupees: number;
      remarks?: string;
    }
  ) {
    return request<{ success: boolean; message: string; transaction: any }>(
      "/staff/teller-withdraw",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
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

  createLiveStream(_legacyToken?: string): EventSource {
    return new EventSource(`${API_BASE_URL}/staff/live-stream`, {
      withCredentials: true,
    });
  },

  getStaffCustomers(
    token: string,
    params: {
      search?: string;
      status?: string;
      kycStatus?: string;
    } = {}
  ) {
    const q = new URLSearchParams();

    if (params.search) q.set("search", params.search);
    if (params.status && params.status !== "all") {
      q.set("status", params.status);
    }
    if (params.kycStatus && params.kycStatus !== "all") {
      q.set("kycStatus", params.kycStatus);
    }

    return request<{ success: boolean; count: number; customers: any[] }>(
      `/staff/customers?${q.toString()}`,
      {},
      token
    );
  },

  
  getStaffEmployees(token: string) {
    return request<{
      success: boolean;
      count: number;
      employees: StaffEmployee[];
    }>("/staff/employees", {}, token);
  },

};
