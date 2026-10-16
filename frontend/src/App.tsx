
import React, { useState, useEffect, useCallback } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { LandingPage } from "./components/LandingPage";
import AuthScreen from "./components/AuthScreen";
import { CustomerDashboard } from "./components/CustomerDashboard";
import { AccountsView } from "./components/AccountsView";
import { TransferView } from "./components/TransferView";
import { DepositsWithdrawalsView } from "./components/DepositsWithdrawalsView";
import { LoansView } from "./components/LoansView";
import { FixedDepositView } from "./components/FixedDepositView";
import TransactionsView from "./components/TransactionsView";
import { ProfileView } from "./components/ProfileView";
import { StaffPortalView } from "./components/StaffPortalView";
import { AdminDashboardView } from "./components/AdminDashboardView";
import { ReceiptModal } from "./components/ReceiptModal";
import { StatementModal } from "./components/StatementModal";

import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";

import {
  api,
  type Customer,
  type BankAccount,
  type BankTransaction,
  type Beneficiary,
  type Loan,
  type FixedDeposit,
  type NotificationItem,
} from "./services/api";

import "./App.css";

type ViewMode = "landing" | "auth" | "app";
type DepositMode = "deposit" | "withdraw";
type Theme = "light" | "dark";

type StaffInitialTab =
  | "live"
  | "teller"
  | "kyc"
  | "loans"
  | "accounts";

type AdminInitialTab =
  | "overview"
  | "customers"
  | "audit"
  | "reports";

// --------------------------------------------------
// Legal pages: available without logging in
// --------------------------------------------------

function LegalPages() {
  return (
    <Routes>
      <Route
        path="/privacy-policy"
        element={<PrivacyPolicy />}
      />
      <Route
        path="/terms-and-conditions"
        element={<TermsAndConditions />}
      />
    </Routes>
  );
}

// --------------------------------------------------
// Main banking application
// --------------------------------------------------

function BankingApp() {
  const location = useLocation();

  // --------------------------------------------------
  // Authentication
  // --------------------------------------------------

  const [token, setToken] = useState<string>(
    () => localStorage.getItem("vb_token") || ""
  );

  const [customer, setCustomer] = useState<Customer | null>(() => {
    const saved = localStorage.getItem("vb_customer");

    if (!saved) return null;

    try {
      return JSON.parse(saved) as Customer;
    } catch {
      localStorage.removeItem("vb_customer");
      return null;
    }
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    localStorage.getItem("vb_token") ? "app" : "landing"
  );

  const [authIsRegister, setAuthIsRegister] = useState(false);

  // --------------------------------------------------
  // Theme handling
  // --------------------------------------------------

  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem("vb_theme") === "dark" ? "dark" : "light"
  );

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;

    localStorage.setItem("vb_theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((previous) =>
      previous === "dark" ? "light" : "dark"
    );
  }, []);

  // --------------------------------------------------
  // Banking data
  // --------------------------------------------------

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [fixedDeposits, setFixedDeposits] = useState<FixedDeposit[]>([]);

  // --------------------------------------------------
  // Notifications
  // --------------------------------------------------

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] =
    useState(0);

  // --------------------------------------------------
  // Navigation
  // --------------------------------------------------

  const [activePage, setActivePage] = useState<string>(() => {
    const saved = localStorage.getItem("vb_customer");

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Customer;

        if (parsed.role === "staff") return "teller";
        if (parsed.role === "admin") return "overview";
      } catch {
        // Use the default page.
      }
    }

    return "overview";
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // --------------------------------------------------
  // Modal state
  // --------------------------------------------------

  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);
  const [showStatementModal, setShowStatementModal] = useState(false);

  const [depWithModalAccount, setDepWithModalAccount] =
    useState<string | undefined>(undefined);

  const [depWithModalMode, setDepWithModalMode] =
    useState<DepositMode>("deposit");

  // --------------------------------------------------
  // Toast notifications
  // --------------------------------------------------

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;

    const timer = window.setTimeout(() => {
      setToastMessage("");
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  // --------------------------------------------------
  // Load banking and notification data
  // --------------------------------------------------

  const loadUserData = useCallback(async () => {
    if (!token) return;

    try {
      const profileResponse = await api.getMe(token).catch(() => null);

      const currentCustomer: Customer | null =
        profileResponse?.customer ?? customer;

      if (profileResponse?.customer) {
        setCustomer(profileResponse.customer);

        localStorage.setItem(
          "vb_customer",
          JSON.stringify(profileResponse.customer)
        );
      }

      const notificationResponse = await api
        .getNotifications(token)
        .catch(() => null);

      if (notificationResponse) {
        setNotifications(notificationResponse.notifications || []);
        setUnreadNotificationsCount(
          notificationResponse.unreadCount || 0
        );
      }

      const currentRole = currentCustomer?.role;

      // CUSTOMER: personal banking information.
      if (currentRole === "customer" || !currentRole) {
        const [
          accountsResponse,
          transactionsResponse,
          beneficiariesResponse,
          loansResponse,
          fixedDepositsResponse,
        ] = await Promise.all([
          api.getAccounts(token),
          api.getTransactions(token, { page: 1, limit: 100 }),
          api.getBeneficiaries(token),
          api.getMyLoans(token),
          api.getFixedDeposits(token),
        ]);

        setAccounts(accountsResponse.accounts || []);
        setTransactions(transactionsResponse.transactions || []);
        setBeneficiaries(beneficiariesResponse.beneficiaries || []);
        setLoans(loansResponse.loans || []);
        setFixedDeposits(fixedDepositsResponse.fixedDeposits || []);

        return;
      }

      // STAFF / ADMIN: management transaction ledger.
      const [accountsResult, ledgerResult] = await Promise.allSettled([
        api.getAccounts(token),
        api.getAllTransactions(token, {
          page: 1,
          limit: 100,
        }),
      ]);

      if (accountsResult.status === "fulfilled") {
        setAccounts(accountsResult.value.accounts || []);
      } else {
        setAccounts([]);

        console.error(
          "Unable to load accounts:",
          accountsResult.reason
        );
      }

      if (ledgerResult.status === "fulfilled") {
        setTransactions(ledgerResult.value.transactions || []);
      } else {
        setTransactions([]);

        console.error(
          "Unable to load staff transaction ledger:",
          ledgerResult.reason
        );

        showToast(
          "Unable to load the transaction ledger. Check permissions and try refreshing."
        );
      }

      setBeneficiaries([]);
      setLoans([]);
      setFixedDeposits([]);
    } catch (error) {
      console.error("Unable to load banking data:", error);
      showToast("Unable to load banking data. Please try again.");
    }
  }, [token, customer, showToast]);

  useEffect(() => {
    if (token) {
      void loadUserData();
    }
  }, [token, loadUserData]);

  // --------------------------------------------------
  // Authentication handlers
  // --------------------------------------------------

  const handleLoginSuccess = (
    newToken: string,
    newCustomer: Customer
  ) => {
    setToken(newToken);
    setCustomer(newCustomer);

    localStorage.setItem("vb_token", newToken);
    localStorage.setItem(
      "vb_customer",
      JSON.stringify(newCustomer)
    );

    setViewMode("app");

    if (newCustomer.role === "staff") {
      setActivePage("teller");
    } else if (newCustomer.role === "admin") {
      setActivePage("overview");
    } else {
      setActivePage("overview");
    }

    setMobileMenuOpen(false);

    // Clear previous-session data while loading the new session.
    setAccounts([]);
    setTransactions([]);
    setBeneficiaries([]);
    setLoans([]);
    setFixedDeposits([]);
    setNotifications([]);
    setUnreadNotificationsCount(0);
  };

  const handleLogout = () => {
    setToken("");
    setCustomer(null);

    localStorage.removeItem("vb_token");
    localStorage.removeItem("vb_customer");

    setViewMode("landing");
    setActivePage("overview");
    setMobileMenuOpen(false);

    setAccounts([]);
    setTransactions([]);
    setBeneficiaries([]);
    setLoans([]);
    setFixedDeposits([]);

    setNotifications([]);
    setUnreadNotificationsCount(0);

    setActiveReceipt(null);
    setShowStatementModal(false);
    setDepWithModalAccount(undefined);
    setDepWithModalMode("deposit");

    showToast("You have been signed out safely.");
  };

  // --------------------------------------------------
  // Demo role switcher
  // --------------------------------------------------
const handleQuickRoleSwitch = async (
  role: "customer" | "staff" | "admin"
) => {
  const credentials: Record<
    "customer" | "staff" | "admin",
    { email: string; pass: string }
  > = {
    customer: {
      email: "demo.customer@example.com",
      pass: "Demo@12345",
    },
    staff: {
      email: "staff@vaultbank.com",
      pass: "Staff@12345",
    },
    admin: {
      email: "admin@vaultbank.com",
      pass: "Admin@12345",
    },
  };

  try {
    const response = await api.login(
      credentials[role].email,
      credentials[role].pass
    );

    // Check that login returned a completed authentication response.
    if (!("token" in response) || !("customer" in response)) {
      setAuthIsRegister(false);
      setViewMode("auth");

      showToast(
        "OTP verification is required. Please sign in and verify your OTP."
      );
      return;
    }

    handleLoginSuccess(response.token, response.customer);

    showToast(
      `Switched persona to ${response.customer.name} (${response.customer.role}).`
    );
  } catch (error: unknown) {
    showToast(
      error instanceof Error
        ? error.message
        : "Failed to switch role persona."
    );
  }
};

const handleDirectDemoLogin = async (
  email: string,
  password: string
) => {
  try {
    const response = await api.login(email, password);

    // An OTP challenge does not contain a token or customer.
    if (!("token" in response) || !("customer" in response)) {
      setAuthIsRegister(false);
      setViewMode("auth");

      showToast(
        "OTP verification is required. Please sign in and verify your OTP."
      );
      return;
    }

    handleLoginSuccess(response.token, response.customer);

    showToast(
      `Welcome, ${response.customer.name} (${response.customer.role}).`
    );
  } catch (error: unknown) {
    showToast(
      error instanceof Error
        ? error.message
        : "Failed to sign in demo persona."
    );
  }
};


  // --------------------------------------------------
  // Notification handlers
  // --------------------------------------------------

  const handleMarkAllNotificationsRead = async () => {
    if (!token) return;

    try {
      await api.markAllNotificationsRead(token);

      setUnreadNotificationsCount(0);

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          read: true,
        }))
      );

      showToast("All notifications marked as read.");
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);

      showToast("Could not update notifications. Please try again.");
    }
  };

  // --------------------------------------------------
  // Navigation handlers
  // --------------------------------------------------

  const handleNavigate = (page: string) => {
    setActivePage(page);
    setMobileMenuOpen(false);
  };

  const handleOpenDeposit = (accountId?: string) => {
    setDepWithModalAccount(accountId);
    setDepWithModalMode("deposit");
    setActivePage("deposits");
  };

  const handleOpenWithdraw = (accountId?: string) => {
    setDepWithModalAccount(accountId);
    setDepWithModalMode("withdraw");
    setActivePage("deposits");
  };

  const handleOpenTransfer = (_accountId?: string) => {
    setActivePage("transfer");
  };

  // --------------------------------------------------
  // Staff tab mapping
  // --------------------------------------------------

  const staffInitialTab: StaffInitialTab = (() => {
    switch (activePage) {
      case "kyc":
        return "kyc";
      case "loans":
        return "loans";
      case "accounts":
        return "accounts";
      case "teller":
        return "teller";
      case "overview":
      default:
        return "live";
    }
  })();

  // --------------------------------------------------
  // Admin tab mapping
  // --------------------------------------------------

  const adminInitialTab: AdminInitialTab = (() => {
    switch (activePage) {
      case "customers":
        return "customers";
      case "audit":
        return "audit";
      case "reports":
        return "reports";
      case "overview":
      default:
        return "overview";
    }
  })();

  // --------------------------------------------------
  // Landing page
  // --------------------------------------------------

  if (viewMode === "landing") {
    return (
      <>
        <LandingPage
          customer={customer}
          onOpenAuth={(isRegister = false) => {
            setAuthIsRegister(isRegister);
            setViewMode("auth");
          }}
          onQuickDemoLogin={handleDirectDemoLogin}
          onEnterDashboard={() => {
            if (!token || !customer) {
              setAuthIsRegister(false);
              setViewMode("auth");
              return;
            }

            setViewMode("app");
          }}
        />

        {toastMessage && (
          <div className="toast-alert" role="status">
            {toastMessage}
          </div>
        )}
      </>
    );
  }

  // --------------------------------------------------
  // Authentication screen
  // --------------------------------------------------

  if (viewMode === "auth" || !token || !customer) {
    return (
      <>
        <AuthScreen
          initialRegister={authIsRegister}
          onLoginSuccess={handleLoginSuccess}
          onBackToLanding={() => setViewMode("landing")}
          onToast={showToast}
        />

        {toastMessage && (
          <div className="toast-alert" role="status">
            {toastMessage}
          </div>
        )}
      </>
    );
  }

  // --------------------------------------------------
  // Main application
  // --------------------------------------------------

  return (
    <div className="app-container">
      <Sidebar
        customer={customer}
        activePage={activePage}
        isOpen={mobileMenuOpen}
        onNavigate={handleNavigate}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onLogout={handleLogout}
      />

      <div className="main-wrapper">
        <Header
          customer={customer}
          notifications={notifications}
          unreadCount={unreadNotificationsCount}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectRole={handleQuickRoleSwitch}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onNavigate={handleNavigate}
          onGoToLanding={() => setViewMode("landing")}
          onLogout={handleLogout}
          currentTheme={theme}
          onToggleTheme={toggleTheme}
        />

        <main className="content-area">
          {/* CUSTOMER PORTAL */}
          {customer.role === "customer" && (
            <>
              {activePage === "overview" && (
                <CustomerDashboard
                  accounts={accounts}
                  transactions={transactions}
                  beneficiaries={beneficiaries}
                  loans={loans}
                  fixedDeposits={fixedDeposits}
                  onNavigate={handleNavigate}
                  onOpenDeposit={handleOpenDeposit}
                  onOpenWithdraw={handleOpenWithdraw}
                  onOpenTransfer={handleOpenTransfer}
                  onOpenStatement={() => setShowStatementModal(true)}
                  onShowReceipt={setActiveReceipt}
                  onToast={showToast}
                />
              )}

              {activePage === "accounts" && (
                <AccountsView
                  token={token}
                  accounts={accounts}
                  onRefreshData={loadUserData}
                  onOpenDeposit={handleOpenDeposit}
                  onOpenWithdraw={handleOpenWithdraw}
                  onOpenTransfer={handleOpenTransfer}
                  onToast={showToast}
                />
              )}

              {activePage === "transfer" && (
                <TransferView
                  token={token}
                  accounts={accounts}
                  beneficiaries={beneficiaries}
                  onRefreshData={loadUserData}
                  onShowReceipt={setActiveReceipt}
                  onToast={showToast}
                />
              )}

              {activePage === "deposits" && (
                <DepositsWithdrawalsView
                  token={token}
                  accounts={accounts}
                  initialTab={depWithModalMode}
                  initialAccountId={depWithModalAccount}
                  onRefreshData={loadUserData}
                  onShowReceipt={setActiveReceipt}
                  onToast={showToast}
                />
              )}

              {activePage === "loans" && (
                <LoansView
                  token={token}
                  accounts={accounts}
                  loans={loans}
                  onRefreshData={loadUserData}
                  onToast={showToast}
                />
              )}

              {activePage === "fixed-deposits" && (
                <FixedDepositView
                  token={token}
                  accounts={accounts}
                  fixedDeposits={fixedDeposits}
                  onRefreshData={loadUserData}
                  onToast={showToast}
                />
              )}

              {activePage === "transactions" && (
                <TransactionsView
                  token={token}
                  accounts={accounts}
                  transactions={transactions}
                  onShowReceipt={setActiveReceipt}
                  onOpenStatement={() => setShowStatementModal(true)}
                />
              )}

              {activePage === "profile" && (
                <ProfileView
                  token={token}
                  customer={customer}
                  onRefreshData={loadUserData}
                  onToast={showToast}
                />
              )}
            </>
          )}

          {/* STAFF PORTAL */}
          {customer.role === "staff" && (
            <>
              {(
                activePage === "teller" ||
                activePage === "kyc" ||
                activePage === "loans" ||
                activePage === "accounts" ||
                activePage === "overview"
              ) && (
                <StaffPortalView
                  token={token}
                  onToast={showToast}
                  onShowReceipt={setActiveReceipt}
                  initialTab={staffInitialTab}
                />
              )}

              {activePage === "transactions" && (
                <TransactionsView
                  token={token}
                  accounts={accounts}
                  transactions={transactions}
                  onShowReceipt={setActiveReceipt}
                  onOpenStatement={() => setShowStatementModal(true)}
                />
              )}

              {activePage === "profile" && (
                <ProfileView
                  token={token}
                  customer={customer}
                  onRefreshData={loadUserData}
                  onToast={showToast}
                />
              )}
            </>
          )}

          {/* ADMIN PORTAL */}
          {customer.role === "admin" && (
            <>
              {(
                activePage === "overview" ||
                activePage === "customers" ||
                activePage === "audit" ||
                activePage === "reports"
              ) && (
                <AdminDashboardView
                  token={token}
                  onToast={showToast}
                  initialTab={adminInitialTab}
                />
              )}

              {activePage === "transactions" && (
                <TransactionsView
                  token={token}
                  accounts={accounts}
                  transactions={transactions}
                  onShowReceipt={setActiveReceipt}
                  onOpenStatement={() => setShowStatementModal(true)}
                />
              )}

              {activePage === "profile" && (
                <ProfileView
                  token={token}
                  customer={customer}
                  onRefreshData={loadUserData}
                  onToast={showToast}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Receipt modal */}
      {activeReceipt && (
        <ReceiptModal
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />
      )}

      {/* Statement modal */}
      {showStatementModal && (
        <StatementModal
          accounts={accounts}
          transactions={transactions}
          onClose={() => setShowStatementModal(false)}
        />
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="toast-alert" role="status">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------
// App routing
// --------------------------------------------------

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/privacy-policy"
          element={<PrivacyPolicy />}
        />

        <Route
          path="/terms-and-conditions"
          element={<TermsAndConditions />}
        />

        <Route
          path="/*"
          element={<BankingApp />}
        />

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
