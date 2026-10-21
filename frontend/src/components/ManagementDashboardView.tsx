import React, { useState } from "react";
import { StaffPortalView } from "./StaffPortalView";
import { CustomerDirectoryView } from "./CustomerDirectoryView";

import { Shield, Users, ContactRound } from "lucide-react";
import { EmployeeDirectoryView } from "./EmployeeDirectoryView";


interface ManagementDashboardViewProps {
  token: string;
  onToast: (msg: string) => void;
}

export const ManagementDashboardView: React.FC<ManagementDashboardViewProps> = ({
  token,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<"staff" | "customers"| "employees">("staff");

  const tabs = [
    { id: "staff" as const, label: "Staff Management", icon: Shield },
    { id: "customers" as const, label: "Customer Management", icon: Users },
    {
    id: "employees" as const,
    label: "Employee Directory",
    icon: ContactRound,
  },

  ];

  return (
    <div className="management-dashboard-view">
      {/* Tab navigation */}
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
              className={`btn ${activeTab === tab.id ? "btn-primary" : "btn-secondary"}`}
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      
        <div className="tab-content">
  {activeTab === "staff" && (
    <StaffPortalView
      token={token}
      onToast={onToast}
      onShowReceipt={() => {}}
      initialTab="live"
    />
  )}

  {activeTab === "customers" && (
    <CustomerDirectoryView token={token} />
  )}

  {activeTab === "employees" && (
    <EmployeeDirectoryView
      token={token}
      onToast={onToast}
    />
  )}
</div>
    </div>
  );
};
