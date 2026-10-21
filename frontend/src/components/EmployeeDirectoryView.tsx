
import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Users, AlertCircle } from "lucide-react";
import { api, type StaffEmployee } from "../services/api";

interface EmployeeDirectoryViewProps {
  token: string;
  onToast: (message: string) => void;
}

export const EmployeeDirectoryView: React.FC<EmployeeDirectoryViewProps> = ({
  token,
  onToast,
}) => {
  const [employees, setEmployees] = useState<StaffEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEmployees = useCallback(async () => {
    if (!token) {
      setError("Please log in to view the employee directory.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.getStaffEmployees(token);
      setEmployees(response.employees ?? []);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to load employee records.";

      setError(message);
      onToast(message);
    } finally {
      setLoading(false);
    }
  }, [token, onToast]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const roleLabel = (role: StaffEmployee["role"]) =>
    role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <section className="employee-directory">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Employee Directory</h2>
          <p style={{ color: "var(--text-muted)", marginTop: 6 }}>
            View VaultBank staff, management, and administrator IDs.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void loadEmployees()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 18,
          marginBottom: 20,
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
        }}
      >
        <Users size={24} />
        <div>
          <strong>{employees.length}</strong>
          <div style={{ color: "var(--text-muted)" }}>
            Employee records
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading employee records...</p>
      ) : error ? (
        <div role="alert" style={{ padding: 16 }}>
          <AlertCircle size={18} />
          <p>{error}</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void loadEmployees()}
          >
            Try again
          </button>
        </div>
      ) : employees.length === 0 ? (
        <p>No employee records were found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead>
              <tr>
                {[
                  "Employee ID",
                  "Name",
                  "Role",
                  "Email",
                  "Phone",
                  "Status",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: 12,
                      borderBottom: "1px solid var(--border-subtle)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td
                    style={{
                      padding: 12,
                      borderBottom: "1px solid var(--border-subtle)",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {employee.employeeId || "Not assigned"}
                  </td>
                  <td style={{ padding: 12 }}>
                    {employee.name}
                  </td>
                  <td style={{ padding: 12 }}>
                    {roleLabel(employee.role)}
                  </td>
                  <td style={{ padding: 12 }}>
                    {employee.email}
                  </td>
                  <td style={{ padding: 12 }}>
                    {employee.phone || "—"}
                  </td>
                  <td style={{ padding: 12 }}>
                    {employee.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
