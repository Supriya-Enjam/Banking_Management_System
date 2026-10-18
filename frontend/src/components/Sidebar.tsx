
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
    if (customer.role === "admin") {
      return [
        { id: "overview", label: "Executive Telemetry", icon: Landmark },
        { id: "customers", label: "Customer Accounts & Limits", icon: Users },
        { id: "audit", label: "Security & Audit Trail", icon: ShieldAlert },
        { id: "reports", label: "Financial Reports", icon: FileText },
        { id: "transactions", label: "All Transactions", icon: Activity },
        { id: "profile", label: "Profile & Settings", icon: Settings },
      ];
    }

    if (customer.role === "staff") {
      return [
        { id: "teller", label: "Branch Cash Counter", icon: DollarSign },
        { id: "kyc", label: "KYC Document Review", icon: Users },
        { id: "loans", label: "Loan Review Queue", icon: CreditCard },
        { id: "accounts", label: "Customer Directory", icon: Landmark },
        { id: "transactions", label: "Transaction Stream", icon: Activity },
        { id: "profile", label: "Profile & Settings", icon: Settings },
      ];
    }

    // Default: Customer
    return [
      { id: "overview", label: "Dashboard Overview", icon: Home },
      { id: "accounts", label: "My Bank Accounts", icon: Landmark },
      { id: "transfer", label: "Send Money & Payees", icon: ArrowLeftRight },
      { id: "deposits", label: "Deposits & Withdrawals", icon: ArrowDownLeft },
      { id: "loans", label: "Loans & Credit Line", icon: CreditCard },
      { id: "fixed-deposits", label: "Fixed Term Deposits", icon: Award },
      { id: "transactions", label: "Ledger & Statements", icon: FileText },
      { id: "sessions", label: "Active Sessions", icon: Monitor },
      { id: "profile", label: "Profile & Security", icon: Settings },
    ];
  };

  const navItems = getNavItems();

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      {/* Mobile Header in Drawer */}
      <div className="sidebar-brand-mobile">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontWeight: 700,
            fontSize: 18,
            color: "#fff",
          }}
        >
          <Landmark size={20} className="text-emerald" />
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

      <nav className="sidebar-nav" aria-label="Main navigation">
        <div className="nav-section-title">
          {customer.role === "admin"
            ? "Enterprise Governance"
            : customer.role === "staff"
              ? "Branch Operations"
              : "Core Banking"}
        </div>

        {navItems.map((item) => {
          const isActive = activePage === item.id;

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
              <item.icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

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
