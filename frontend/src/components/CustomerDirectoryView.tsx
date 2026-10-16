import React from "react";

interface CustomerDirectoryViewProps {
  token: string;
}

export const CustomerDirectoryView: React.FC<
  CustomerDirectoryViewProps
> = ({ token }) => {
  return (
    <section className="card-panel">
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

      <p
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          marginBottom: 16,
        }}
      >
        View and manage registered VaultBank customers.
      </p>

      {!token && (
        <p style={{ color: "var(--rose)" }}>
          Please log in to access the customer directory.
        </p>
      )}

      {token && (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          The customer directory component is ready. Customer data loading
          and management actions can be connected to the staff API next.
        </p>
      )}
    </section>
  );
};

export default CustomerDirectoryView;