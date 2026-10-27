import React from "react";
import {
  Home,
  Landmark,
  ArrowLeftRight,
  ArrowDownLeft,
  CreditCard,
  Award,
  FileText,
  Settings,
  LogOut,
  Users,
  DollarSign,
  ShieldAlert,
  Activity,
  X,
  Monitor,
  ShieldCheck,
  Building2,
  MessageSquare,
  LifeBuoy,
} from "lucide-react";

import type { Customer } from "../services/api";

interface SidebarProps {
  customer: Customer;
  activePage: string;
  isOpen: boolean;
  onNavigate: (page: string) => void;
  onCloseMobile: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  customer,
  activePage,
  isOpen,
  onNavigate,
  onCloseMobile,
  onLogout,
}) => {
  const getNavItems = () => {
    // ADMIN: All management and administrative navigation
    if (customer.role === "admin") {
      return [
        {
          id: "overview",
          label: "Executive Dashboard",
          icon: Landmark,
        },
        {
          id: "management",
          label: "Management Dashboard",
          icon: Building2,
        },
        {
          id: "customers",
          label: "Customer Accounts & Limits",
          icon: Users,
        },
        {
          id: "audit",
          label: "Security & Audit Trail",
          icon: ShieldAlert,
        },
        {
          id: "reports",
          label: "Financial Reports",
          icon: FileText,
        },
        {
          id: "messages",
          label: "Internal Messages",
          icon: MessageSquare,
        },
        {
          id: "transactions",
          label: "All Transactions",
          icon: Activity,
        },
        {
          id: "profile",
          label: "Profile & Settings",
          icon: Settings,
        },
      ];
    }

    // MANAGEMENT: Staff oversight and customer management
    if (customer.role === "management") {
      return [
        {
          id: "management",
          label: "Management Dashboard",
          icon: Building2,
        },
        {
          id: "transactions",
          label: "Transaction Monitoring",
          icon: Activity,
        },
        {
          id: "messages",
          label: "Internal Messages",
          icon: MessageSquare,
        },
        {
          id: "profile",
          label: "Profile & Settings",
          icon: Settings,
        },
      ];
    }

    // STAFF: Branch and customer-service operations
    if (customer.role === "staff") {
      return [
        {
          id: "teller",
          label: "Branch Cash Counter",
          icon: DollarSign,
        },
        {
          id: "kyc",
          label: "KYC Document Review",
          icon: Users,
        },
        {
          id: "loans",
          label: "Loan Review Queue",
          icon: CreditCard,
        },
        {
          id: "accounts",
          label: "Customer Directory",
          icon: Landmark,
        },
        {
          id: "transactions",
          label: "Transaction Stream",
          icon: Activity,
        },
        {
          id: "messages",
          label: "Internal Messages",
          icon: MessageSquare,
        },
        {
          id: "profile",
          label: "Profile & Settings",
          icon: Settings,
        },
      ];
    }

    // CUSTOMER: Personal banking
    return [
      {
        id: "overview",
        label: "Dashboard Overview",
        icon: Home,
      },
      {
        id: "accounts",
        label: "My Bank Accounts",
        icon: Landmark,
      },
      {
        id: "cards",
        label: "Debit Cards",
        icon: CreditCard,
      },
      {
        id: "credit-cards",
        label: "Credit Cards",
        icon: CreditCard,
      },
      {
        id: "credit-card-application",
        label: "Credit Card Application",
        icon: FileText,
      },
      {
        id: "transfer",
        label: "Send Money & Payees",
        icon: ArrowLeftRight,
      },
      {
        id: "deposits",
        label: "Deposits & Withdrawals",
        icon: ArrowDownLeft,
      },
      {
        id: "loans",
        label: "Loans & Credit Line",
        icon: CreditCard,
      },
      {
        id: "fixed-deposits",
        label: "Fixed Term Deposits",
        icon: Award,
      },
      {
        id: "transactions",
        label: "Ledger & Statements",
        icon: FileText,
      },
      {
        id: "sessions",
        label: "Active Sessions",
        icon: Monitor,
      },
      {
        id: "support",
        label: "Help & Support",
        icon: LifeBuoy,
      },
      {
        id: "profile",
        label: "Profile & Security",
        icon: Settings,
      },
    ];
  };

  const navItems = getNavItems();

  const sectionTitle =
    customer.role === "admin"
      ? "Enterprise Administration"
      : customer.role === "management"
        ? "Management & Oversight"
        : customer.role === "staff"
          ? "Branch Operations"
          : "Personal Banking";

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      {/* Mobile Sidebar Header */}
      <div className="sidebar-brand-mobile">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontWeight: 700,
            fontSize: 18,
            color: "var(--brand-navy)",
          }}
        >
          <Landmark size={20} className="text-sapphire" />
          <span>VaultBank</span>
        </div>

        <button
          type="button"
          className="icon-btn"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        <div className="nav-section-title">{sectionTitle}</div>

        {navItems.map((item) => {
          const isActive = activePage === item.id;
          const Icon = item.icon;

          return (
            <button
              type="button"
              key={item.id}
              className={`nav-item ${isActive ? "active" : ""}`}
              onClick={() => {
                onNavigate(item.id);
                onCloseMobile();
              }}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <button
          type="button"
          className="logout-btn"
          onClick={onLogout}
        >
          <LogOut size={16} aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;