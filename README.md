# VaultBank — Enterprise Banking & Treasury Management System

VaultBank is a production-grade, full-stack Banking Management System designed to handle core banking operations with role-based access control, transaction validation, loan life-cycles, fixed term deposits, branch teller desks, and executive administration with an immutable audit trail.

---

## 🌟 Key Features Implemented

### 1. High-Converting Modern Fintech Landing Page
- **Hero Showcase**: Luminous dark-mode fintech aesthetic with 3D-styled floating bank card, real-time live balance telemetry, and regulatory trust badges.
- **Interactive Financial Calculators**:
  - **Fixed Deposit Calculator**: Dynamic principal slider, tenure selector, quarterly compound interest computation up to 8.25% p.a.
  - **Loan EMI Calculator**: Product selection, principal slider, tenure slider, automated monthly EMI and repayment schedule.
- **Multi-Role Experience Showcase**: Interactive tabbed deck demonstrating tailored workflows for Customers, Bank Staff, and Admins with 1-click persona demo launchers.
- **Security & Compliance Architecture**: Central bank compliance, 256-bit TLS encryption, ISO 27001 certification, and DICGC insurance details.
- **Interactive FAQ Accordion**: Common questions regarding transfers, deposits, and account types.

### 2. User Registration & Secure Authentication
- Customer self-registration with full legal name, email, phone, residential address, and secure password hashing (`bcryptjs`).
- Role-Based Access Control (**RBAC**) for **Customers**, **Bank Staff**, and **Admins**.
- Secure session management with JSON Web Tokens (**JWT**).
- **1-Click Demo Persona Switcher** on the login screen for instant testing without typing credentials.

### 2. Multi-Account Management
- Support for multiple account types: **Savings Account** (4.0% p.a.), **Current / Checking Account** (zero fee), and **Commercial Business Account** (priority limits).
- Instant account number generation (`VB...`) with copy-to-clipboard functionality.
- Live balance tracking and multi-account portfolio overview.
- Account status lifecycle: `active`, `frozen` (compliance hold), and `closed`.

### 3. Deposits & Withdrawals
- Instant account deposit simulation with source categorization (Salary, Wire, Cheque, Investment).
- Cash / wire withdrawal with daily transaction limit verification and real-time overdraft protection.

### 4. Fund Transfers & Beneficiary Management
- Real-time fund transfers to any internal VaultBank account number or external bank account.
- **Auto Payee Detection**: Typing an account number automatically verifies and previews the account holder's name.
- Saved frequent beneficiaries registry with bank name, IFSC/routing code, and custom nicknames.
- Real-time balance debited from sender and credited to recipient with dual ledger records.

### 5. Daily Transaction Limits & Protection
- Automated validation of today's cumulative debits against account and customer daily limits.
- Visual progress bar indicator tracking remaining daily limit allowance in real-time.

### 6. Loan Application & EMI Calculator
- Interactive loan calculator with dynamic tenure (6 to 120 months) and principal sliders.
- Loan categories: **Personal** (10.5%), **Home** (8.4%), **Vehicle** (9.0%), **Education** (7.5%), and **Business** (11.5%).
- Automated monthly EMI and total interest calculation using the compound reducing-balance formula.
- Customer loan management: track loan status (`pending`, `approved`, `rejected`), tenure progress bar, and 1-click **Pay EMI** directly from bank account balance.

### 7. Fixed Term Deposits (FD)
- High-yield term deposits with quarterly compound interest calculation ($A = P(1 + r/4)^{4t}$).
- Tenure options: 6 Months (6.5%), 1 Year (7.25%), 2 Years (7.75%), and 3+ Years (8.25%).
- Automated creation of unique certificate numbers (`FD-VB-...`).
- **Premature Liquidation**: Liquidate active fixed deposits early with immediate return of principal and accrued returns directly to the linked checking/savings account.

### 8. Official Transaction Receipts & Account Statements
- **High-Fidelity Transaction Receipts**: Official printable receipt modal with reference IDs, QR code preview, timestamps, sender/receiver details, and one-click PDF printing.
- **Statement Generator**: Custom date interval filter (Last 30 Days, Last Quarter, Financial Year, Custom Range) with:
  - Total Credits (+), Total Debits (-), and Net Cashflow metrics.
  - **Download CSV**: Direct RFC 4180 CSV export.
  - **Print PDF**: Clean printable styling via `@media print`.

### 9. Branch Teller Counter & Staff Operations
- **Branch Teller Desk**: Staff can process walk-in cash deposits and cash withdrawals for any customer account with automated reference number generation and counterfoil receipts.
- **KYC Review Queue**: Staff can review customer verification records and approve or reject KYC with custom remarks.
- **Loan Approvals Queue**: Staff inspect applicant purpose, tenure, and credit risk to approve (disburses loan funds instantly to customer account) or reject with notes.
- **Customer Accounts Oversight**: Staff can freeze or unfreeze accounts to handle compliance holds.

### 10. Executive Admin & Risk Telemetry
- Macro KPIs: Total Bank Reserves (₹), Active Users, Disbursed Loans Portfolio, and 24h Transaction Volume.
- **Customer Accounts Manager**: Search any customer, update account statuses, edit KYC tiers, adjust daily transaction limits, or modify user roles.
- **Security Audit Trail**: System-wide audit log capturing every user action (`LOGIN`, `FUNDS_TRANSFERRED`, `LOAN_APPROVED`, `ACCOUNT_FROZEN`, etc.), user email, severity level (`info`, `warning`, `critical`), client IP, and timestamp.
- **Financial Distribution Reports**: Graphical breakdown of transaction volume by category, loan portfolio exposure, and account type distribution.

---

## 🔑 Demo Login Credentials

For quick evaluation, use the 1-click demo buttons on the login screen or enter the credentials below:

| Role | Name | Email | Password | Access Highlights |
| :--- | :--- | :--- | :--- | :--- |
| **Customer** | Alexander Morgan | `demo.customer@example.com` | `Demo@12345` | Savings & Business accounts, Transfers, Loans, FDs, Receipts, Statements |
| **Bank Staff** | Arthur Vance | `staff@vaultbank.com` | `Staff@12345` | Cash Teller Counter, KYC Review, Loan Approvals Queue |
| **Administrator** | Victoria Sterling | `admin@vaultbank.com` | `Admin@12345` | Macro Telemetry, Customer Management, Audit Trail, Financial Reports |

---

## 🛠️ Technology Stack

- **Backend**: Node.js, Express, TypeScript, MongoDB, Mongoose, Zod, BcryptJS, JSONWebToken, Helmet, CORS.
- **Frontend**: React 19, TypeScript, Vite, Vanilla CSS design system, Lucide React icons.
- **Database**: MongoDB with ReplicaSet transaction support.

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js (v18+)
- MongoDB running locally on port `27017`

### 1. Backend Setup
```bash
cd backend
npm install
npm run dev
```
The backend server runs at `http://localhost:5000` and automatically connects to MongoDB and seeds initial demo data.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The frontend application will be live at `http://localhost:5173`.

## 🔐 Authentication Cookies

VaultBank creates the HTTP-only `vaultbank_token` cookie only after email OTP
verification succeeds and the corresponding database session has been stored.
The cookie is sent automatically with API requests; frontend JavaScript does
not read or persist the VaultBank JWT. Cookie consent preferences remain
separate from this essential authentication cookie.

### Local HTTP development

Configure the backend environment (keep secrets in your local environment,
never in source control):

```text
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
AUTH_COOKIE_SAME_SITE=lax
```

The frontend defaults to `http://localhost:5000/api`. To use a different API
address, set `VITE_API_URL` in the frontend environment, including the `/api`
suffix, for example `http://localhost:5000/api`.

### Production deployment

- Set `NODE_ENV=production`, and set `FRONTEND_URL` to the exact HTTPS frontend
  origin (multiple comma-separated origins are supported when needed).
- Set the frontend `VITE_API_URL` to the HTTPS API base URL, ending in `/api`.
- Keep the frontend and API on the same site where possible and use
  `AUTH_COOKIE_SAME_SITE=lax`. If they must be cross-site, set
  `AUTH_COOKIE_SAME_SITE=none`; this is accepted only in production, where the
  cookie is automatically marked `Secure`.
- Keep `JWT_SECRET` and other backend secrets server-side. Do not add the JWT
  to frontend storage or URLs.

The API uses credentialed CORS for the configured frontend origin and validates
request origins on state-changing operations. Authenticated browser requests
must include their Origin header.

## Internal employee chat

Socket.IO chat is available only to active `staff`, `management`, and `admin`
sessions. It uses the existing HTTP-only `vaultbank_token` cookie and the
existing database session; no additional chat token or public document route
is used. Start the backend and frontend with the commands above. Configure the
frontend's exact public support contacts only when approved values are
available:

```text
VITE_SUPPORT_PHONE=
VITE_SUPPORT_EMAIL=
VITE_SUPPORT_HOURS=
VITE_EMERGENCY_PHONE=
```

If these values are unset, the customer Help & Support page shows configuration
placeholders rather than invented contact details. Keep frontend environment
values free of secrets.
