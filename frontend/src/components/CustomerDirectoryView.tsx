
import React, { useCallback, useEffect, useState } from "react";
import { api, type Customer } from "../services/api";

interface CustomerDirectoryViewProps {
  token: string;
}

type DirectoryCustomer = Customer & {
  status?: string;
  kycStatus?: string;
  createdAt?: string;
};

const CustomerDirectoryView: React.FC<CustomerDirectoryViewProps> = ({
  token,
}) => {
  const [customers, setCustomers] = useState<DirectoryCustomer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCustomers = useCallback(async () => {
    if (!token) {
      setCustomers([]);
      setError("Please log in to access the customer directory.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.getStaffCustomers(token, {
        search: search.trim() || undefined,
      });

      setCustomers(response.customers ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load customers. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  return (
    <section className="card-panel">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 8,
              color: "var(--text-main)",
            }}
          >
            Customer Directory
          </h2>

          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            View registered VaultBank customers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadCustomers()}
          disabled={loading || !token}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by customer name or email..."
        aria-label="Search customers"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "11px 12px",
          marginBottom: 16,
          border: "1px solid var(--border-color, #d1d5db)",
          borderRadius: 8,
          background: "var(--surface, transparent)",
          color: "var(--text-main)",
        }}
      />

      {error && (
        <div
          role="alert"
          style={{
            padding: 12,
            marginBottom: 16,
            borderRadius: 8,
            color: "var(--rose)",
          }}
        >
          {error}
          <button
            type="button"
            onClick={() => void loadCustomers()}
            style={{ marginLeft: 12 }}
          >
            Retry
          </button>
        </div>
      )}

      {loading && (
        <p style={{ color: "var(--text-muted)" }}>
          Loading customer records...
        </p>
      )}

      {!loading && !error && customers.length === 0 && (
        <p style={{ color: "var(--text-muted)", padding: 16 }}>
          No customers found.
        </p>
      )}

      {!loading && !error && customers.length > 0 && (
        <>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {customers.length} customer record(s) returned
          </p>

          <div style={{ width: "100%", overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                minWidth: 650,
              }}
            >
              <thead>
                <tr>
                  {["Customer", "Email", "Phone", "KYC Status", "Joined"].map(
                    (heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: 12,
                          borderBottom: "1px solid var(--border-color, #ddd)",
                          color: "var(--text-muted)",
                          fontSize: 13,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {customers.map((customer, index) => (
                  <tr key={customer.id || customer.email || index}>
                    <td
                      style={{
                        padding: 12,
                        borderBottom: "1px solid var(--border-color, #eee)",
                        color: "var(--text-main)",
                      }}
                    >
                      {customer.name || "—"}
                    </td>

                    <td
                      style={{
                        padding: 12,
                        borderBottom: "1px solid var(--border-color, #eee)",
                      }}
                    >
                      {customer.email || "—"}
                    </td>

                    <td
                      style={{
                        padding: 12,
                        borderBottom: "1px solid var(--border-color, #eee)",
                      }}
                    >
                      {customer.phone || "—"}
                    </td>

                    <td
                      style={{
                        padding: 12,
                        borderBottom: "1px solid var(--border-color, #eee)",
                      }}
                    >
                      {customer.kycStatus || "Pending / not specified"}
                    </td>

                    <td
                      style={{
                        padding: 12,
                        borderBottom: "1px solid var(--border-color, #eee)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {customer.createdAt
                        ? new Date(customer.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};

export { CustomerDirectoryView };
export default CustomerDirectoryView;
