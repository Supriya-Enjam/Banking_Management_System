import React, { useState } from "react";
import { User, Shield, Lock, Phone, MapPin, Mail, CheckCircle, AlertCircle, Key } from "lucide-react";
import { api, type Customer } from "../services/api";

interface ProfileViewProps {
  token: string;
  customer: Customer;
  onRefreshData: () => Promise<void>;
  onToast: (msg: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  token,
  customer,
  onRefreshData,
  onToast,
}) => {
  // Profile update form
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone || "");
  const [address, setAddress] = useState(customer.address || "");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // Password update form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passError, setPassError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg("");
    setUpdatingProfile(true);

    try {
      await api.updateProfile(token, { name, phone, address });
      onToast("Profile updated successfully!");
      setProfileMsg("Contact details updated successfully.");
      await onRefreshData();
    } catch (err: any) {
      setProfileMsg(err.message || "Failed to update profile.");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError("");
    setPassSuccess("");

    if (newPassword.length < 6) {
      setPassError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError("New passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      await api.changePassword(token, { currentPassword, newPassword });
      onToast("Account password changed successfully!");
      setPassSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPassError(err.message || "Failed to update password.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile & Security Settings</h1>
          <p className="page-subtitle">Personal information, KYC verification status, and authentication security</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24 }}>
        {/* Profile Details */}
        <div className="card-panel">
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18, color: "var(--text-main)" }}>
            Personal & Contact Details
          </h2>

          {profileMsg && (
            <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--emerald)", padding: 12, borderRadius: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <CheckCircle size={16} /> {profileMsg}
            </div>
          )}

          <form onSubmit={handleUpdateProfile}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address (Read-only)</label>
              <input
                type="email"
                value={customer.email}
                disabled
                style={{ opacity: 0.7, cursor: "not-allowed" }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Residential Address</label>
              <textarea
                rows={3}
                placeholder="Full address..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }} disabled={updatingProfile}>
              {updatingProfile ? "Saving Changes..." : "Save Profile Details"}
            </button>
          </form>
        </div>

        {/* KYC & Password */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* KYC Card */}
          <div className="card-panel">
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: "var(--text-main)" }}>
              KYC Compliance Status
            </h3>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-input)", padding: 16, borderRadius: 12, border: "1px solid var(--border-subtle)", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>Verification Tier</div>
                <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>Biometric & Address verification</div>
              </div>
              <span className={`status-pill ${customer.kycStatus || 'verified'}`}>
                {customer.kycStatus || "verified"}
              </span>
            </div>

            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
              ✓ Unlimited online transfers up to ₹{(customer.dailyLimitRupees || 50000).toLocaleString()} daily.
              <br />
              ✓ Eligible for pre-approved credit lines and fixed deposit certificates.
            </div>
          </div>

          {/* Change Password Card */}
          <div className="card-panel">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Lock size={18} className="text-sapphire" />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)" }}>Change Password</h3>
            </div>

            {passError && (
              <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--rose)", padding: 10, borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>
                {passError}
              </div>
            )}

            {passSuccess && (
              <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--emerald)", padding: 10, borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>
                {passSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-secondary" style={{ width: "100%", marginTop: 8 }} disabled={changingPassword}>
                <Key size={15} /> {changingPassword ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
