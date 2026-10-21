
import React, { useState } from "react";
import {
  Menu,
  Bell,
  Search,
  Shield,
  LogOut,
  Settings,
  Landmark,
  ChevronDown,
  Moon,
  Sun,
} from "lucide-react";

import type { Customer, NotificationItem } from "../services/api";

type Theme = "light" | "dark";

interface HeaderProps {
  customer: Customer;
  notifications: NotificationItem[];
  unreadCount: number;
  onOpenMobileMenu: () => void;
  onSelectRole: (role: "customer" | "staff" | "management"| "admin") => void;
  onMarkAllNotificationsRead: () => void;
  onNavigate: (page: string) => void;
  onGoToLanding?: () => void;
  onLogout: () => void;
  currentTheme: Theme;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  customer,
  notifications,
  unreadCount,
  onOpenMobileMenu,
  onSelectRole,
  onMarkAllNotificationsRead,
  onNavigate,
  onGoToLanding,
  onLogout,
  currentTheme,
  onToggleTheme,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const getInitials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const handleRoleChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    onSelectRole(
      event.target.value as "customer" | "staff" | "management" |"admin"
    );
  };

  return (
    <header className="top-header">
      {/* Left section */}
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
        >
          <Menu size={22} />
        </button>

        <div className="brand-badge">
          <div className="brand-icon">
            <Landmark size={20} />
          </div>

          <span>VaultBank</span>
        </div>

        <div className={`role-badge ${customer.role}`}>
          <Shield size={12} />

          <span>
            {customer.role === "admin"
              ? "Executive Admin"
              : customer.role === "management"
              ? "Management Portal"
              : customer.role === "staff"
                ? "Bank Staff Portal"
                : "Customer Portal"}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="header-search">
        <Search size={16} color="var(--text-faint)" />

        <input
          type="search"
          placeholder="Search accounts, transfers, or transactions..."
          aria-label="Search banking records"
          onFocus={() => {
            if (customer.role === "admin") {
              onNavigate("customers");
            } else if (customer.role === "management") {
              onNavigate("management");
            } else {
              onNavigate("transactions");
            }
          }}
        />
      </div>

      {/* Header actions */}
      <div className="header-actions">
        {/* Public website */}
        {onGoToLanding && (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={onGoToLanding}
            title="View public landing page"
            style={{ fontSize: 12, padding: "6px 12px" }}
          >
            Public Site
          </button>
        )}

        {/* Light / dark theme toggle */}
        <button
          type="button"
          className="icon-btn theme-toggle-btn"
          onClick={onToggleTheme}
          title={`Switch to ${
            currentTheme === "dark" ? "light" : "dark"
          } theme`}
          aria-label={`Switch to ${
            currentTheme === "dark" ? "light" : "dark"
          } theme`}
          aria-pressed={currentTheme === "dark"}
        >
          {currentTheme === "dark" ? (
            <Sun size={19} />
          ) : (
            <Moon size={19} />
          )}
        </button>

        {/* Demo role switcher */}
        <div className="quick-switch-wrapper">
          <span className="quick-switch-label">Switch Role:</span>

          <select
            className="quick-switch-select"
            value={customer.role}
            onChange={handleRoleChange}
            aria-label="Switch demo role"
            title="Switch role for testing"
          >
            <option value="customer">
              Customer (Alexander Morgan)
            </option>

            <option value="staff">
              Bank Staff (Arthur Vance)
            </option>

            <option value="management">
            Management (Management Portal)
            </option>
            <option value="admin">
              Administrator (Victoria Sterling)
            </option>
          </select>
        </div>

        {/* Notifications */}
        <div className="header-dropdown-anchor">
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setShowNotifications((previous) => !previous);
              setShowProfileMenu(false);
            }}
            title="Notifications"
            aria-label={`Notifications, ${unreadCount} unread`}
            aria-expanded={showNotifications}
          >
            <Bell size={18} />

            {unreadCount > 0 && (
              <span className="badge-dot">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="notification-drawer">
              <div className="notification-header">
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  Notifications ({unreadCount} new)
                </span>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    style={{
                      fontSize: 11.5,
                      color: "var(--emerald)",
                      fontWeight: 600,
                    }}
                    onClick={onMarkAllNotificationsRead}
                  >
                    Mark All Read
                  </button>
                )}
              </div>

              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div
                    style={{
                      padding: 24,
                      textAlign: "center",
                      color: "var(--text-faint)",
                      fontSize: 12.5,
                    }}
                  >
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`notification-item ${
                        notification.read ? "" : "unread"
                      }`}
                    >
                      <div
                        className="notification-icon"
                        style={{
                          background:
                            notification.type === "loan"
                              ? "rgba(245, 158, 11, 0.15)"
                              : notification.type === "security"
                                ? "rgba(239, 68, 68, 0.15)"
                                : "rgba(16, 185, 129, 0.15)",
                          color:
                            notification.type === "loan"
                              ? "var(--amber)"
                              : notification.type === "security"
                                ? "var(--rose)"
                                : "var(--emerald)",
                        }}
                      >
                        <Shield size={14} />
                      </div>

                      <div className="notification-content">
                        <div className="notification-title">
                          {notification.title}
                        </div>

                        <div className="notification-msg">
                          {notification.message}
                        </div>

                        <div className="notification-time">
                          {new Date(
                            notification.createdAt
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User profile menu */}
        <div className="header-dropdown-anchor">
          <button
            type="button"
            className="user-profile-menu"
            onClick={() => {
              setShowProfileMenu((previous) => !previous);
              setShowNotifications(false);
            }}
            aria-expanded={showProfileMenu}
            aria-label="Open user profile menu"
          >
            <div className="user-avatar">
              {getInitials(customer.name)}
            </div>

            <div className="user-meta">
              <span className="user-meta-name">
                {customer.name}
              </span>

              <span className="user-meta-role">
                {customer.role}
              </span>
            </div>

            <ChevronDown
              size={14}
              color="var(--text-faint)"
            />
          </button>

          {showProfileMenu && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-info">
                <div className="profile-dropdown-name">
                  {customer.name}
                </div>

                <div className="profile-dropdown-email">
                  {customer.email}
                </div>
              </div>

              <button
                type="button"
                className="nav-item"
                onClick={() => {
                  onNavigate("profile");
                  setShowProfileMenu(false);
                }}
              >
                <Settings size={15} />
                Profile &amp; Security
              </button>

              <button
                type="button"
                className="nav-item profile-signout"
                onClick={() => {
                  setShowProfileMenu(false);
                  onLogout();
                }}
              >
                <LogOut size={15} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
