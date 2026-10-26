
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
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
import { ManagementDashboardView } from "./components/ManagementDashboardView";
import { ReceiptModal } from "./components/ReceiptModal";
import { StatementModal } from "./components/StatementModal";
import ActiveSessionsView from "./components/ActiveSessionsView";
import { SessionExpiryCard } from "./components/SessionExpiryCard";

import CardsView from "./components/CardsView";
import CreditCardApplicationView from "./components/CreditCardApplicationView";
import CreditCardsView from "./components/CreditCardsView";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsAndConditions from "./pages/TermsAndConditions";

import { CookieConsent } from "./components/CookieConsent";

import {
  api,
  ApiError,
  type Customer,
  type BankAccount,
  type BankTransaction,
  type Beneficiary,
  type Loan,
  type FixedDeposit,
  type NotificationItem,
} from "./services/api";

import "./App.css";

// --------------------------------------------------
// Types
// --------------------------------------------------

type ViewMode = "checking" | "landing" | "auth" | "app";
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
// Session configuration
// --------------------------------------------------

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

// TESTING: Show the warning after 30 seconds of inactivity.
// Change to 13 * 60 * 1000 after testing.
const SESSION_WARNING_AFTER_MS = 30 * 1000;

// Refresh server activity at most once per minute.
const SESSION_PING_INTERVAL_MS = 60 * 1000;

// Countdown displayed by SessionExpiryCard.
const SESSION_COUNTDOWN_SECONDS = 120;

// --------------------------------------------------
// Main application
// --------------------------------------------------

function BankingApp() {
  // --------------------------------------------------
  // Authentication and session state
  // --------------------------------------------------

  const [showSessionExpiry, setShowSessionExpiry] = useState(false);

  // This marker only gates authenticated UI; authentication is held in an
  // HTTP-only cookie and is never exposed to JavaScript.
  const [token, setToken] = useState("");

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

  const [viewMode, setViewMode] = useState<ViewMode>("checking");

  const [authIsRegister, setAuthIsRegister] = useState(false);

  const sessionWarningTimerRef = useRef<number | null>(null);
  const lastSessionPingAtRef = useRef(0);
  const sessionWarningOpenRef = useRef(false);

  useEffect(() => {
    let active = true;
    localStorage.removeItem("vb_token");

    void api
      .getMe("")
      .then((response) => {
        if (!active) return;
        setCustomer(response.customer);
        setToken("cookie-session");
        localStorage.setItem(
          "vb_customer",
          JSON.stringify(response.customer)
        );
        setViewMode("app");
      })
      .catch(() => {
        if (!active) return;
        setToken("");
        setCustomer(null);
        localStorage.removeItem("vb_customer");
        setViewMode("landing");
      });

    return () => {
      active = false;
    };
  }, []);

  // IMPORTANT:
  // This boolean remains stable when the customer object is refreshed.
  // It prevents the inactivity timer from restarting just because
  // loadUserData() receives an updated customer object.
  const isCustomerReady = Boolean(customer);

  // Keep the warning ref synchronized with React state.
  useEffect(() => {
    sessionWarningOpenRef.current = showSessionExpiry;
  }, [showSessionExpiry]);

  // --------------------------------------------------
  // Theme
  // --------------------------------------------------

  const [theme, setTheme] = useState<Theme>("light");

useEffect(() => {
  const root = document.documentElement;

  root.classList.remove("dark");
  root.dataset.theme = "light";

  localStorage.setItem("vb_theme", "light");
}, []);

const toggleTheme = useCallback(() => {
  // Keep VaultBank in the requested white-and-purple theme.
  setTheme("light");
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
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  // --------------------------------------------------
  // Navigation
  // --------------------------------------------------

  const [activePage, setActivePage] = useState<string>(() => {
    const saved = localStorage.getItem("vb_customer");

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Customer;

        if (parsed.role === "staff") return "teller";
        if (parsed.role === "management") return "management";
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
  // Logout
  // --------------------------------------------------

  const handleLogout = useCallback(
    (message = "You have been signed out safely.") => {
      void api.logout().catch((error: unknown) => {
        console.error("Backend logout request failed:", error);
      });

      if (sessionWarningTimerRef.current !== null) {
        window.clearTimeout(sessionWarningTimerRef.current);
        sessionWarningTimerRef.current = null;
      }

      sessionWarningOpenRef.current = false;
      lastSessionPingAtRef.current = 0;

      setShowSessionExpiry(false);
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

      showToast(message);
    },
    [showToast]
  );

  // --------------------------------------------------
  // Load banking and notification data
  // --------------------------------------------------

  const loadUserData = useCallback(async () => {
    if (!token) return;

    try {
      let profileResponse;

      try {
        profileResponse = await api.getMe(token);
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 401) {
          handleLogout("Your session has expired. Please sign in again.");
          return;
        }
        throw error;
      }

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
        setUnreadNotificationsCount(notificationResponse.unreadCount || 0);
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
          api.getTransactions(token, {
            page: 1,
            limit: 100,
          }),
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

      // STAFF / MANAGEMENT / ADMIN: management transaction ledger.
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
    } catch (error: unknown) {
      console.error("Unable to load banking data:", error);

      showToast(
        error instanceof Error
          ? error.message
          : "Unable to load banking data. Please try again."
      );

      throw error;
    }
  }, [token, customer, showToast, handleLogout]);

  useEffect(() => {
    if (token) {
      void loadUserData().catch(() => {
        // Error is logged and displayed by loadUserData.
      });
    }
  }, [token, loadUserData]);

  // --------------------------------------------------
  // Session activity monitoring
  // --------------------------------------------------

  useEffect(() => {
    if (!token || viewMode !== "app" || !isCustomerReady) {
      if (sessionWarningTimerRef.current !== null) {
        window.clearTimeout(sessionWarningTimerRef.current);
        sessionWarningTimerRef.current = null;
      }

      setShowSessionExpiry(false);
      sessionWarningOpenRef.current = false;

      return;
    }

    let disposed = false;

    const clearWarningTimer = () => {
      if (sessionWarningTimerRef.current !== null) {
        window.clearTimeout(sessionWarningTimerRef.current);
        sessionWarningTimerRef.current = null;
      }
    };

    const scheduleWarning = () => {
      clearWarningTimer();

      if (sessionWarningOpenRef.current || disposed) {
        return;
      }

      console.log(
        `Session warning scheduled for ${
          SESSION_WARNING_AFTER_MS / 1000
        } seconds.`
      );

      sessionWarningTimerRef.current = window.setTimeout(() => {
        if (disposed || sessionWarningOpenRef.current) {
          return;
        }

        console.log("Session warning timer fired. Opening warning card.");

        sessionWarningOpenRef.current = true;
        setShowSessionExpiry(true);
      }, SESSION_WARNING_AFTER_MS);
    };

    const refreshServerActivity = async () => {
      const now = Date.now();

      if (now - lastSessionPingAtRef.current < SESSION_PING_INTERVAL_MS) {
        return;
      }

      lastSessionPingAtRef.current = now;

      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/session/keep-alive`,
          {
            method: "POST",
            credentials: "include",
          }
        );

        if (disposed) return;

        if (response.status === 401 || response.status === 403) {
          showToast("Your session has expired. Please sign in again.");
          handleLogout();
        }
      } catch (error) {
        console.error("Session activity refresh failed:", error);
      }
    };

    const handleUserActivity = () => {
      if (sessionWarningOpenRef.current || disposed) {
        return;
      }

      scheduleWarning();
      void refreshServerActivity();
    };

    const activityEvents = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
    ] as const;

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleUserActivity, {
        passive: true,
      });
    });

    // Start the timer when the authenticated app opens.
    scheduleWarning();

    return () => {
      disposed = true;
      clearWarningTimer();

      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserActivity);
      });
    };
  }, [
    token,
    viewMode,
    isCustomerReady,
    showToast,
    handleLogout,
  ]);

  // --------------------------------------------------
  // Authentication handlers
  // --------------------------------------------------

  const handleLoginSuccess = (newCustomer: Customer) => {
    if (sessionWarningTimerRef.current !== null) {
      window.clearTimeout(sessionWarningTimerRef.current);
      sessionWarningTimerRef.current = null;
    }

    sessionWarningOpenRef.current = false;
    lastSessionPingAtRef.current = 0;

    setShowSessionExpiry(false);
    setToken("cookie-session");
    setCustomer(newCustomer);

    localStorage.setItem(
      "vb_customer",
      JSON.stringify(newCustomer)
    );

    setViewMode("app");

    if (newCustomer.role === "staff") {
      setActivePage("teller");
    } else if (newCustomer.role === "management") {
      setActivePage("management");
    } else if (newCustomer.role === "admin") {
      setActivePage("overview");
    } else {
      setActivePage("overview");
    }

    setMobileMenuOpen(false);

    setAccounts([]);
    setTransactions([]);
    setBeneficiaries([]);
    setLoans([]);
    setFixedDeposits([]);
    setNotifications([]);
    setUnreadNotificationsCount(0);
  };

  // --------------------------------------------------
  // Session warning actions
  // --------------------------------------------------

  const handleStayLoggedIn = async () => {
    if (!token) {
      handleLogout();
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/session/keep-alive`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        showToast("Your session has expired. Please sign in again.");
        handleLogout();
        return;
      }

      lastSessionPingAtRef.current = Date.now();
      sessionWarningOpenRef.current = false;
      setShowSessionExpiry(false);

      // Start a fresh inactivity period after successful confirmation.
      if (sessionWarningTimerRef.current !== null) {
        window.clearTimeout(sessionWarningTimerRef.current);
        sessionWarningTimerRef.current = null;
      }

      showToast("Your session is still active.");
    } catch (error) {
      console.error("Unable to keep the session active:", error);
      showToast("Unable to refresh your session. Please try again.");
    }
  };

  // --------------------------------------------------
  // Demo role switcher
  // --------------------------------------------------

  const handleQuickRoleSwitch = async (
    role: "customer" | "staff" | "management" | "admin"
  ) => {
    const credentials: Record<
      "customer" | "staff" | "management" | "admin",
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
      management: {
        email: "management@vaultbank.com",
        pass: "Management@12345",
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

      if (!("customer" in response)) {
        setAuthIsRegister(false);
        setViewMode("auth");

        showToast(
          "OTP verification is required. Please sign in and verify your OTP."
        );

        return;
      }

      handleLoginSuccess(response.customer);

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

      if (!("customer" in response)) {
        setAuthIsRegister(false);
        setViewMode("auth");

        showToast(
          "OTP verification is required. Please sign in and verify your OTP."
        );

        return;
      }

      handleLoginSuccess(response.customer);

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
    } catch (error: unknown) {
      console.error(
        "Failed to mark notifications as read:",
        error
      );

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

  if (viewMode === "checking") {
    return (
      <main className="auth-loading-screen" role="status" aria-live="polite">
        Checking your VaultBank session…
      </main>
    );
  }

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

              {activePage === "accounts" && customer && (
                <AccountsView
                  token={token}
                  customer={customer}
                  accounts={accounts}
                  onRefreshData={loadUserData}
                  onOpenDeposit={handleOpenDeposit}
                  onOpenWithdraw={handleOpenWithdraw}
                  onOpenTransfer={handleOpenTransfer}
                  onToast={showToast}
                />
              )}

              {activePage === "cards" && (
                <CardsView
                  token={token}
                  accounts={accounts}
                  onRefreshData={loadUserData}
                  onToast={showToast}
                />
              )}

              {activePage === "credit-cards" && (
                <CreditCardsView token={token} onToast={showToast} />
              )}

              {activePage === "credit-card-application" && (
                <CreditCardApplicationView
                  token={token}
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
                  onRefreshData={loadUserData}
                />
              )}

              {activePage === "sessions" && (
                <ActiveSessionsView token={token} onToast={showToast} />
              )}

              {activePage === "profile" && (
                <ProfileView
                  token={token}
                  customer={customer}
                  onRefreshData={loadUserData}
                  onToast={showToast}
                  onLogout={() =>
                    handleLogout("Password updated. Please sign in again.")
                  }
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
                  onRefreshData={loadUserData}
                />
              )}

              {activePage === "profile" && (
                <ProfileView
                  token={token}
                  customer={customer}
                  onRefreshData={loadUserData}
                  onToast={showToast}
                  onLogout={() =>
                    handleLogout("Password updated. Please sign in again.")
                  }
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
                  onRefreshData={loadUserData}
                />
              )}

              {activePage === "profile" && (
                <ProfileView
                  token={token}
                  customer={customer}
                  onRefreshData={loadUserData}
                  onToast={showToast}
                  onLogout={() =>
                    handleLogout("Password updated. Please sign in again.")
                  }
                />
              )}
            </>
          )}

          {/* MANAGEMENT PORTAL */}
          {customer.role === "management" && (
            <>
              {activePage === "management" && (
                <ManagementDashboardView
                  token={token}
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
                  onRefreshData={loadUserData}
                />
              )}

              {activePage === "profile" && (
                <ProfileView
                  token={token}
                  customer={customer}
                  onRefreshData={loadUserData}
                  onToast={showToast}
                  onLogout={() =>
                    handleLogout("Password updated. Please sign in again.")
                  }
                />
              )}
            </>
          )}

          {/* Allow admins to open the management dashboard too. */}
          {customer.role === "admin" && activePage === "management" && (
            <ManagementDashboardView
              token={token}
              onToast={showToast}
            />
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

      {/* Session expiry warning */}
      <SessionExpiryCard
        open={showSessionExpiry}
        onStayLoggedIn={handleStayLoggedIn}
        onLogout={handleLogout}
      />

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
       {/* Cookie Consent banner */}

      <CookieConsent />
    </BrowserRouter>
  );


}
