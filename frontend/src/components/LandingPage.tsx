
import React, { useState, useEffect } from "react";
import {
  Landmark,
  Shield,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Award,
  Users,
  CheckCircle,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  DollarSign,
  Sparkles,
  Lock,
  Zap,
  Globe,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Calculator,
  Laptop,
} from "lucide-react";
import type { Customer } from "../services/api";
import "../LandingPage.css";

interface LandingPageProps {
  customer: Customer | null;
  onOpenAuth: (isRegister?: boolean) => void;
  onQuickDemoLogin: (email: string, pass: string) => void;
  onEnterDashboard: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  customer,
  onOpenAuth,
  onQuickDemoLogin,
  onEnterDashboard,
}) => {
  const [calcTab, setCalcTab] = useState<"fd" | "loan">("fd");

  // Fixed deposit calculator
  const [fdAmount, setFdAmount] = useState(100000);
  const [fdTenure, setFdTenure] = useState(12);
  const [fdRate, setFdRate] = useState(7.25);
  const [fdMaturity, setFdMaturity] = useState(0);
  const [fdInterest, setFdInterest] = useState(0);

  // Loan calculator
  const [loanType, setLoanType] = useState<
    "Personal" | "Home" | "Vehicle" | "Business"
  >("Personal");
  const [loanAmount, setLoanAmount] = useState(300000);
  const [loanTenure, setLoanTenure] = useState(24);
  const [loanEmi, setLoanEmi] = useState(0);
  const [loanTotalInterest, setLoanTotalInterest] = useState(0);

  // Role showcase
  const [roleTab, setRoleTab] = useState<"customer" | "staff" | "admin">(
    "customer"
  );

  // FAQ
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    let rate = 7.25;

    if (fdTenure < 12) rate = 6.5;
    else if (fdTenure < 24) rate = 7.25;
    else if (fdTenure < 36) rate = 7.75;
    else rate = 8.25;

    setFdRate(rate);

    const years = fdTenure / 12;
    const maturity = Math.round(
      fdAmount * Math.pow(1 + rate / 400, 4 * years)
    );

    setFdMaturity(maturity);
    setFdInterest(maturity - fdAmount);
  }, [fdAmount, fdTenure]);

  useEffect(() => {
    const rates = {
      Personal: 10.5,
      Home: 8.4,
      Vehicle: 9.0,
      Business: 11.5,
    };

    const rate = rates[loanType];
    const monthlyRate = rate / 12 / 100;
    const factor = Math.pow(1 + monthlyRate, loanTenure);
    const emi = Math.round(
      (loanAmount * monthlyRate * factor) / (factor - 1)
    );
    const totalRepay = emi * loanTenure;

    setLoanEmi(emi);
    setLoanTotalInterest(totalRepay - loanAmount);
  }, [loanAmount, loanTenure, loanType]);

  const toggleFaq = (idx: number) => {
    setOpenFaq((current) => (current === idx ? null : idx));
  };

  const loginCustomerDemo = () =>
    onQuickDemoLogin("demo.customer@example.com", "Demo@12345");

  const faqs = [
    {
      q: "How fast are inter-account and inter-bank transfers?",
      a: "Transfers to other VaultBank accounts settle instantaneously with real-time balance updates. External transfer processing depends on the supported payment method and banking hours.",
    },
    {
      q: "What interest rate is provided on Fixed Deposits?",
      a: "The displayed rates are illustrative rates for this project demo. Actual deposit rates depend on the product and applicable terms.",
    },
    {
      q: "Can I open multiple bank accounts?",
      a: "Customers can open supported account types, subject to the rules configured in the application. Each account can have its own transaction limits.",
    },
    {
      q: "How does the Loan approval process work?",
      a: "Customers submit an application with the requested amount, purpose, and tenure. Staff can review the application and make a decision through the relevant workflow.",
    },
    {
      q: "What are the daily transaction limits?",
      a: "Transaction limits depend on the account configuration and verification status. The application can apply different limits to different account types.",
    },
  ];

  return (
    <div className="landing-wrapper">
      {/* Background lighting */}
      <div className="landing-ambient-orb-1" />
      <div className="landing-ambient-orb-2" />
      <div className="landing-ambient-orb-3" />

      {/* Header navigation */}
      <nav className="landing-nav">
        <div
          className="landing-brand"
          onClick={() =>
            window.scrollTo({ top: 0, behavior: "smooth" })
          }
        >
          <div className="landing-brand-icon">
            <Landmark size={20} />
          </div>
          <span>VaultBank</span>
        </div>

        <div className="landing-nav-links">
          <a href="#features" className="landing-nav-link">
            Features
          </a>
          <a href="#calculators" className="landing-nav-link">
            Calculators
          </a>
          <a href="#roles" className="landing-nav-link">
            Role Experience
          </a>
          <a href="#security" className="landing-nav-link">
            Security &amp; Risk
          </a>
          <a href="#faq" className="landing-nav-link">
            FAQs
          </a>
        </div>

        <div className="landing-nav-actions">
          {customer ? (
            <button
              className="btn-landing-primary"
              onClick={onEnterDashboard}
            >
              <Laptop size={16} />
              Enter Dashboard ({customer.name})
            </button>
          ) : (
            <>
              <button
                className="btn-landing-secondary"
                style={{ padding: "10px 18px", fontSize: 13.5 }}
                onClick={() => onOpenAuth(false)}
              >
                Sign In
              </button>
              <button
                className="btn-landing-primary"
                style={{ padding: "10px 20px", fontSize: 13.5 }}
                onClick={() => onOpenAuth(true)}
              >
                Open Account
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero section */}
      <section className="landing-hero">
        <div>
          <div className="landing-hero-badge">
            <Sparkles size={14} />
            Next-Generation Core Banking &amp; Treasury
          </div>

          <h1 className="landing-hero-title">
            The Digital Bank Engineered for <br />
            <span className="landing-gradient-text">
              Absolute Financial Integrity.
            </span>
          </h1>

          <p className="landing-hero-subtitle">
            Seamlessly manage savings, current, and business accounts.
            Explore fund transfers, fixed deposit estimates, loan
            calculations, and banking operations through this interactive
            banking project.
          </p>

          <div className="landing-hero-cta">
            <button
              className="btn-landing-primary"
              onClick={() => onOpenAuth(true)}
            >
              Open Free Account <ArrowRight size={16} />
            </button>
            <button
              className="btn-landing-secondary"
              onClick={loginCustomerDemo}
            >
              <Zap size={16} className="text-emerald" />
              Try Customer Demo
            </button>
          </div>

          <div className="landing-trust-bar">
            <div className="landing-trust-item">
              <ShieldCheck size={16} className="text-emerald" />
              Secure Authentication
            </div>
            <div className="landing-trust-item">
              <CheckCircle size={16} className="text-emerald" />
              Transaction Validation
            </div>
            <div className="landing-trust-item">
              <Award size={16} className="text-emerald" />
              Account Management
            </div>
            <div className="landing-trust-item">
              <Lock size={16} className="text-emerald" />
              Protected Access
            </div>
          </div>
        </div>

        {/* Hero banking card */}
        <div className="landing-hero-visual">
          <div className="floating-bank-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 18,
                  letterSpacing: -0.5,
                  color: "#fff",
                }}
              >
                VAULTBANK PLATINUM
              </div>
              <Landmark size={20} color="#10b981" />
            </div>

            <div className="card-chip" />
            <div className="card-number-display">
              VB8820 •••• •••• 4291
            </div>

            <div className="card-footer-info">
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.6)",
                    textTransform: "uppercase",
                  }}
                >
                  Card Holder
                </div>
                <div className="card-holder-name">Alexander Morgan</div>
              </div>
              <div className="card-balance-highlight">
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.6)",
                    textTransform: "uppercase",
                  }}
                >
                  Primary Balance
                </div>
                <div className="card-balance-val">₹1,25,000.00</div>
              </div>
            </div>
          </div>

          <div className="floating-stats-pill">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(16, 185, 129, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#10b981",
                }}
              >
                <ArrowDownLeft size={20} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  Direct Salary Credited
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  Demo transaction · Settled
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#10b981",
                }}
              >
                +₹50,000.00
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: "#10b981",
                  fontWeight: 600,
                }}
              >
                Example
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core features */}
      <section id="features" className="landing-section">
        <div className="section-header-center">
          <span className="section-tag">Enterprise Capabilities</span>
          <h2 className="section-heading">
            Everything You Need from a Modern Bank
          </h2>
          <p className="section-subheading">
            Explore account management, transaction validation, deposit
            calculations, and multi-role banking workflows.
          </p>
        </div>

        <div className="landing-features-grid">
          <div className="landing-feature-card">
            <div
              className="landing-feature-icon"
              style={{
                background: "rgba(16, 185, 129, 0.15)",
                color: "var(--emerald)",
              }}
            >
              <Zap size={24} />
            </div>
            <h3 className="landing-feature-title">
              Fund Transfers
            </h3>
            <p className="landing-feature-desc">
              Explore the fund transfer workflow and account balance
              validation available in the application.
            </p>
          </div>

          <div className="landing-feature-card">
            <div
              className="landing-feature-icon"
              style={{
                background: "rgba(59, 130, 246, 0.15)",
                color: "var(--sapphire)",
              }}
            >
              <Landmark size={24} />
            </div>
            <h3 className="landing-feature-title">
              Account Management
            </h3>
            <p className="landing-feature-desc">
              Review supported account types and manage banking details
              through the available dashboard features.
            </p>
          </div>

          <div className="landing-feature-card">
            <div
              className="landing-feature-icon"
              style={{
                background: "rgba(245, 158, 11, 0.15)",
                color: "var(--amber)",
              }}
            >
              <TrendingUp size={24} />
            </div>
            <h3 className="landing-feature-title">
              Fixed Deposit Calculator
            </h3>
            <p className="landing-feature-desc">
              Estimate maturity values and interest using the illustrative
              rates configured in this demo.
            </p>
          </div>

          <div className="landing-feature-card">
            <div
              className="landing-feature-icon"
              style={{
                background: "rgba(99, 102, 241, 0.15)",
                color: "#a5b4fc",
              }}
            >
              <CreditCard size={24} />
            </div>
            <h3 className="landing-feature-title">
              Loan EMI Calculator
            </h3>
            <p className="landing-feature-desc">
              Estimate monthly repayments for different loan types, amounts,
              and repayment periods.
            </p>
          </div>

          <div className="landing-feature-card">
            <div
              className="landing-feature-icon"
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                color: "var(--rose)",
              }}
            >
              <ShieldCheck size={24} />
            </div>
            <h3 className="landing-feature-title">
              Transaction Validation
            </h3>
            <p className="landing-feature-desc">
              Demonstrate validation rules designed to prevent invalid
              transactions and unauthorized account operations.
            </p>
          </div>

          <div className="landing-feature-card">
            <div
              className="landing-feature-icon"
              style={{
                background: "rgba(16, 185, 129, 0.15)",
                color: "var(--emerald)",
              }}
            >
              <FileText size={24} />
            </div>
            <h3 className="landing-feature-title">
              Statements &amp; Receipts
            </h3>
            <p className="landing-feature-desc">
              Explore available transaction history, statement, and receipt
              features in the banking dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive calculators */}
      <section
        id="calculators"
        className="landing-section"
        style={{ background: "rgba(255, 255, 255, 0.01)" }}
      >
        <div className="section-header-center">
          <span className="section-tag">Interactive Tools</span>
          <h2 className="section-heading">Plan Your Wealth &amp; Credit</h2>
          <p className="section-subheading">
            Estimate fixed deposit returns or calculate monthly loan EMI
            using the values selected below.
          </p>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 24,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              className={`btn ${
                calcTab === "fd" ? "btn-primary" : "btn-secondary"
              }`}
              onClick={() => setCalcTab("fd")}
            >
              <Award size={16} /> Fixed Deposit Calculator
            </button>
            <button
              className={`btn ${
                calcTab === "loan" ? "btn-primary" : "btn-secondary"
              }`}
              onClick={() => setCalcTab("loan")}
            >
              <CreditCard size={16} /> Loan EMI Calculator
            </button>
          </div>
        </div>

        {calcTab === "fd" ? (
          <div className="calc-card-container">
            <div>
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#fff",
                  marginBottom: 20,
                }}
              >
                Fixed Deposit Simulator
              </h3>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <label className="form-label">
                    Deposit Principal Amount
                  </label>
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: "#10b981",
                    }}
                  >
                    ₹{fdAmount.toLocaleString("en-IN")}
                  </span>
                </div>

                <input
                  type="range"
                  min="10000"
                  max="1000000"
                  step="10000"
                  value={fdAmount}
                  onChange={(e) => setFdAmount(Number(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: "var(--emerald)",
                    cursor: "pointer",
                    marginTop: 8,
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "var(--text-faint)",
                  }}
                >
                  <span>₹10,000</span>
                  <span>₹10,00,000</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Tenure &amp; Annual Yield
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 12,
                    marginTop: 8,
                  }}
                >
                  {[
                    { m: 6, label: "6 Months", rate: "6.50%" },
                    { m: 12, label: "1 Year", rate: "7.25%" },
                    { m: 24, label: "2 Years", rate: "7.75%" },
                    { m: 36, label: "3 Years", rate: "8.25%" },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.m}
                      style={{
                        background:
                          fdTenure === item.m
                            ? "rgba(16, 185, 129, 0.15)"
                            : "var(--bg-input)",
                        border:
                          fdTenure === item.m
                            ? "1px solid var(--emerald)"
                            : "1px solid var(--border-subtle)",
                        borderRadius: 10,
                        padding: "12px 8px",
                        textAlign: "center",
                        color:
                          fdTenure === item.m
                            ? "var(--emerald)"
                            : "var(--text-main)",
                        cursor: "pointer",
                      }}
                      onClick={() => setFdTenure(item.m)}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {item.label}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        {item.rate}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="calc-result-panel">
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#10b981",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Estimated Maturity ({fdRate}% p.a., quarterly compounding)
                </div>
                <div
                  style={{
                    fontSize: 38,
                    fontWeight: 800,
                    color: "#fff",
                    marginTop: 8,
                  }}
                >
                  ₹{fdMaturity.toLocaleString("en-IN")}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "#10b981",
                    fontWeight: 600,
                    marginTop: 4,
                  }}
                >
                  +₹{fdInterest.toLocaleString("en-IN")} Estimated Interest
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  paddingTop: 16,
                  marginTop: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    marginBottom: 8,
                    color: "#94a3b8",
                  }}
                >
                  <span>Initial Deposit:</span>
                  <span style={{ color: "#fff", fontWeight: 600 }}>
                    ₹{fdAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    marginBottom: 16,
                    color: "#94a3b8",
                  }}
                >
                  <span>Compounding Cycle:</span>
                  <span style={{ color: "#fff", fontWeight: 600 }}>
                    Quarterly
                  </span>
                </div>

                <button
                  className="btn-landing-primary"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={loginCustomerDemo}
                >
                  Explore FD in Demo <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="calc-card-container">
            <div>
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#fff",
                  marginBottom: 20,
                }}
              >
                Loan Repayment &amp; EMI Estimator
              </h3>

              <div className="form-group" style={{ marginBottom: 18 }}>
                <label className="form-label">Loan Product</label>
                <select
                  value={loanType}
                  onChange={(e) =>
                    setLoanType(
                      e.target.value as
                        | "Personal"
                        | "Home"
                        | "Vehicle"
                        | "Business"
                    )
                  }
                >
                  <option value="Personal">Personal Loan (10.5% p.a.)</option>
                  <option value="Home">Home Loan (8.4% p.a.)</option>
                  <option value="Vehicle">Vehicle Loan (9.0% p.a.)</option>
                  <option value="Business">
                    Business Loan (11.5% p.a.)
                  </option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <label className="form-label">Requested Loan Amount</label>
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: "var(--sapphire)",
                    }}
                  >
                    ₹{loanAmount.toLocaleString("en-IN")}
                  </span>
                </div>

                <input
                  type="range"
                  min="50000"
                  max="5000000"
                  step="50000"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: "var(--sapphire)",
                    cursor: "pointer",
                    marginTop: 6,
                  }}
                />
              </div>

              <div className="form-group">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <label className="form-label">Tenure Duration</label>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    {loanTenure} Months (
                    {Math.round((loanTenure / 12) * 10) / 10} Years)
                  </span>
                </div>

                <input
                  type="range"
                  min="6"
                  max="120"
                  step="6"
                  value={loanTenure}
                  onChange={(e) => setLoanTenure(Number(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: "var(--sapphire)",
                    cursor: "pointer",
                    marginTop: 6,
                  }}
                />
              </div>
            </div>

            <div
              className="calc-result-panel"
              style={{ border: "1px solid rgba(59, 130, 246, 0.3)" }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--sapphire)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Estimated Monthly EMI
                </div>
                <div
                  style={{
                    fontSize: 38,
                    fontWeight: 800,
                    color: "#fff",
                    marginTop: 8,
                  }}
                >
                  ₹{loanEmi.toLocaleString("en-IN")}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--amber)",
                    fontWeight: 600,
                    marginTop: 4,
                  }}
                >
                  ₹{loanTotalInterest.toLocaleString("en-IN")} Estimated
                  Interest
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  paddingTop: 16,
                  marginTop: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    marginBottom: 16,
                    color: "#94a3b8",
                    gap: 12,
                  }}
                >
                  <span>Total Repayment:</span>
                  <span style={{ color: "#fff", fontWeight: 700 }}>
                    ₹{(loanEmi * loanTenure).toLocaleString("en-IN")}
                  </span>
                </div>

                <button
                  className="btn-landing-primary"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                  }}
                  onClick={loginCustomerDemo}
                >
                  Explore Loan Demo <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Role experience showcase */}
      <section id="roles" className="landing-section">
        <div className="section-header-center">
          <span className="section-tag">Role-Based Experiences</span>
          <h2 className="section-heading">
            Designed for Every Banking Stakeholder
          </h2>
          <p className="section-subheading">
            Explore the different interfaces designed for customers, staff, and
            administrators.
          </p>

          <div className="roles-tabs-bar" style={{ marginTop: 24 }}>
            <button
              className={`role-tab-btn ${
                roleTab === "customer" ? "active" : ""
              }`}
              onClick={() => setRoleTab("customer")}
            >
              <Users size={16} /> Customer Portal
            </button>
            <button
              className={`role-tab-btn ${
                roleTab === "staff" ? "active" : ""
              }`}
              onClick={() => setRoleTab("staff")}
            >
              <DollarSign size={16} /> Bank Staff &amp; Teller Counter
            </button>
            <button
              className={`role-tab-btn ${
                roleTab === "admin" ? "active" : ""
              }`}
              onClick={() => setRoleTab("admin")}
            >
              <Landmark size={16} /> Executive Admin
            </button>
          </div>
        </div>

        {roleTab === "customer" && (
          <div className="role-showcase-box">
            <div>
              <span className="role-badge customer">Customer Experience</span>
              <h3
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#fff",
                  marginTop: 12,
                }}
              >
                Personal &amp; Commercial Banking
              </h3>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: 15,
                  marginTop: 10,
                  lineHeight: 1.6,
                }}
              >
                Explore account management, transfers, transaction limits,
                fixed deposits, and loan facilities through the customer
                workspace.
              </p>

              <div className="role-checklist">
                <div className="role-check-item">
                  <CheckCircle
                    size={18}
                    className="text-emerald"
                    style={{ flexShrink: 0 }}
                  />
                  <span>Transaction review and recipient validation</span>
                </div>
                <div className="role-check-item">
                  <CheckCircle
                    size={18}
                    className="text-emerald"
                    style={{ flexShrink: 0 }}
                  />
                  <span>Transaction history and statement features</span>
                </div>
                <div className="role-check-item">
                  <CheckCircle
                    size={18}
                    className="text-emerald"
                    style={{ flexShrink: 0 }}
                  />
                  <span>Deposit and loan management workflows</span>
                </div>
              </div>

              <button
                className="btn-landing-primary"
                onClick={loginCustomerDemo}
              >
                Launch Customer Workspace <ArrowRight size={16} />
              </button>
            </div>

            <div
              style={{
                background: "rgba(10, 15, 29, 0.9)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 20,
                padding: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  paddingBottom: 12,
                  marginBottom: 16,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  Sample Customer Dashboard
                </span>
                <span className="role-badge customer">Demo Account</span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  marginBottom: 6,
                }}
              >
                Example Savings Balance
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#fff",
                  marginBottom: 14,
                }}
              >
                ₹1,25,000.00
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    background: "rgba(16, 185, 129, 0.1)",
                    padding: 10,
                    borderRadius: 8,
                    fontSize: 12,
                    textAlign: "center",
                    color: "#10b981",
                    fontWeight: 600,
                  }}
                >
                  Sample Account
                </div>
                <div
                  style={{
                    flex: 1,
                    background: "rgba(59, 130, 246, 0.1)",
                    padding: 10,
                    borderRadius: 8,
                    fontSize: 12,
                    textAlign: "center",
                    color: "var(--sapphire)",
                    fontWeight: 600,
                  }}
                >
                  Example Limit
                </div>
              </div>
            </div>
          </div>
        )}

        {roleTab === "staff" && (
          <div className="role-showcase-box">
            <div>
              <span className="role-badge staff">Bank Staff Operations</span>
              <h3
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#fff",
                  marginTop: 12,
                }}
              >
                Branch Teller &amp; Operations
              </h3>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: 15,
                  marginTop: 10,
                  lineHeight: 1.6,
                }}
              >
                Explore teller workflows for deposits, withdrawals, customer
                verification, and loan application review.
              </p>

              <div className="role-checklist">
                <div className="role-check-item">
                  <CheckCircle
                    size={18}
                    className="text-sapphire"
                    style={{ flexShrink: 0 }}
                  />
                  <span>Deposit and withdrawal workflow</span>
                </div>
                <div className="role-check-item">
                  <CheckCircle
                    size={18}
                    className="text-sapphire"
                    style={{ flexShrink: 0 }}
                  />
                  <span>Customer verification workflow</span>
                </div>
                <div className="role-check-item">
                  <CheckCircle
                    size={18}
                    className="text-sapphire"
                    style={{ flexShrink: 0 }}
                  />
                  <span>Loan application review</span>
                </div>
              </div>

              <button
                className="btn-landing-primary"
                style={{
                  background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                }}
                onClick={() =>
                  onQuickDemoLogin("staff@vaultbank.com", "Staff@12345")
                }
              >
                Explore Staff Portal <ArrowRight size={16} />
              </button>
            </div>

            <div
              style={{
                background: "rgba(10, 15, 29, 0.9)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 20,
                padding: 24,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  paddingBottom: 12,
                  marginBottom: 16,
                }}
              >
                Teller Operations Preview
              </div>
              <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7 }}>
                This area represents the staff workspace. The information and
                available actions depend on your backend implementation and
                signed-in staff permissions.
              </p>
            </div>
          </div>
        )}

        {roleTab === "admin" && (
          <div className="role-showcase-box">
            <div>
              <span className="role-badge admin">Administration</span>
              <h3
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#fff",
                  marginTop: 12,
                }}
              >
                Banking Administration &amp; Audit
              </h3>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: 15,
                  marginTop: 10,
                  lineHeight: 1.6,
                }}
              >
                Explore administrative workflows for account oversight,
                transaction monitoring, and audit history.
              </p>

              <div className="role-checklist">
                <div className="role-check-item">
                  <CheckCircle
                    size={18}
                    className="text-emerald"
                    style={{ flexShrink: 0 }}
                  />
                  <span>Account and transaction monitoring</span>
                </div>
                <div className="role-check-item">
                  <CheckCircle
                    size={18}
                    className="text-emerald"
                    style={{ flexShrink: 0 }}
                  />
                  <span>Account status management</span>
                </div>
                <div className="role-check-item">
                  <CheckCircle
                    size={18}
                    className="text-emerald"
                    style={{ flexShrink: 0 }}
                  />
                  <span>Administrative audit history</span>
                </div>
              </div>

              <button
                className="btn-landing-primary"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #4338ca)",
                }}
                onClick={() =>
                  onQuickDemoLogin("admin@vaultbank.com", "Admin@12345")
                }
              >
                Explore Admin Console <ArrowRight size={16} />
              </button>
            </div>

            <div
              style={{
                background: "rgba(10, 15, 29, 0.9)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 20,
                padding: 24,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  paddingBottom: 12,
                  marginBottom: 16,
                }}
              >
                Administrative Preview
              </div>
              <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7 }}>
                Administrative data and actions should be provided by the
                authenticated backend, with permissions enforced server-side.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Security section */}
      <section id="security" className="landing-section">
        <div className="section-header-center">
          <span className="section-tag">Security &amp; Risk</span>
          <h2 className="section-heading">
            Security at Every Step
          </h2>
          <p className="section-subheading">
            Explore the security-related controls implemented in this banking
            application. Production compliance requires independent review
            and verification.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          <div
            style={{
              background: "rgba(19, 27, 46, 0.5)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: 24,
            }}
          >
            <Lock
              size={28}
              className="text-emerald"
              style={{ marginBottom: 14 }}
            />
            <h4
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                marginBottom: 8,
              }}
            >
              Credential Protection
            </h4>
            <p
              style={{
                fontSize: 13.5,
                color: "#94a3b8",
                lineHeight: 1.6,
              }}
            >
              Password hashing and token verification should be handled
              securely by the backend using the project's configured
              authentication mechanisms.
            </p>
          </div>

          <div
            style={{
              background: "rgba(19, 27, 46, 0.5)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: 24,
            }}
          >
            <ShieldCheck
              size={28}
              className="text-sapphire"
              style={{ marginBottom: 14 }}
            />
            <h4
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                marginBottom: 8,
              }}
            >
              Transaction Validation
            </h4>
            <p
              style={{
                fontSize: 13.5,
                color: "#94a3b8",
                lineHeight: 1.6,
              }}
            >
              Validate balances, account ownership, transaction amounts,
              and limits before accepting financial operations.
            </p>
          </div>

          <div
            style={{
              background: "rgba(19, 27, 46, 0.5)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: 24,
            }}
          >
            <FileText
              size={28}
              className="text-amber"
              style={{ marginBottom: 14 }}
            />
            <h4
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                marginBottom: 8,
              }}
            >
              Audit History
            </h4>
            <p
              style={{
                fontSize: 13.5,
                color: "#94a3b8",
                lineHeight: 1.6,
              }}
            >
              Record important authentication and transaction events so
              authorized staff can investigate activity.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ section */}
      <section id="faq" className="landing-section">
        <div className="section-header-center">
          <span className="section-tag">
            Frequently Asked Questions
          </span>
          <h2 className="section-heading">
            Answers to Common Inquiries
          </h2>
          <p className="section-subheading">
            Learn about account management, transaction workflows, and the
            calculators available in this project.
          </p>
        </div>

        <div className="faq-grid">
          {faqs.map((item, idx) => (
            <div
              key={idx}
              className={`faq-card ${openFaq === idx ? "open" : ""}`}
            >
              <button
                type="button"
                className="faq-question"
                aria-expanded={openFaq === idx}
                onClick={() => toggleFaq(idx)}
              >
                <span>{item.q}</span>
                {openFaq === idx ? (
                  <ChevronUp size={18} color="var(--emerald)" />
                ) : (
                  <ChevronDown size={18} />
                )}
              </button>

              {openFaq === idx && (
                <div className="faq-answer">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Call to action */}
      <div className="landing-cta-banner">
        <div style={{ position: "relative", zIndex: 10 }}>
          <h2
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: "#fff",
              marginBottom: 14,
            }}
          >
            Ready to Experience the Future of Core Banking?
          </h2>
          <p
            style={{
              color: "#cbd5e1",
              fontSize: 16,
              maxWidth: 600,
              margin: "0 auto 30px",
            }}
          >
            Explore account management, deposits, lending calculations, and
            banking workflows in VaultBank.
          </p>

          <div
            style={{
              display: "flex",
              gap: 14,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              className="btn-landing-primary"
              onClick={() => onOpenAuth(true)}
            >
              Open Free Account <ArrowRight size={16} />
            </button>
            <button
              className="btn-landing-secondary"
              onClick={loginCustomerDemo}
            >
              Launch Live Interactive Demo
            </button>
          </div>
        </div>
      </div>

      {/* Footer — Quick Demo Access removed */}
      <footer className="landing-footer">
        <div className="footer-top">
          <div>
            <div
              className="landing-brand"
              style={{ marginBottom: 14 }}
            >
              <div className="landing-brand-icon">
                <Landmark size={20} />
              </div>
              <span>VaultBank</span>
            </div>
            <p
              style={{
                color: "#94a3b8",
                fontSize: 13.5,
                lineHeight: 1.6,
                maxWidth: 300,
              }}
            >
              Explore account management, deposit estimates, lending
              calculations, and banking operations in this project.
            </p>
          </div>

          <div>
            <div className="footer-col-title">Banking Products</div>
            <ul className="footer-links">
              <li>
                <a href="#features" className="footer-link">
                  Savings Accounts
                </a>
              </li>
              <li>
                <a href="#features" className="footer-link">
                  Commercial Business
                </a>
              </li>
              <li>
                <a href="#calculators" className="footer-link">
                  Term Deposit Calculator
                </a>
              </li>
              <li>
                <a href="#calculators" className="footer-link">
                  Personal &amp; Home Loans
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="footer-col-title">
              Operations &amp; Security
            </div>
            <ul className="footer-links">
              <li>
                <a href="#security" className="footer-link">
                  Security Architecture
                </a>
              </li>
              <li>
                <a href="#roles" className="footer-link">
                  Branch Teller Operations
                </a>
              </li>
              <li>
                <a href="#roles" className="footer-link">
                  Administrative Overview
                </a>
              </li>
              <li>
                <a href="#faq" className="footer-link">
                  Security FAQs
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>
            © {new Date().getFullYear()} VaultBank. All rights reserved.
          </div>

          <div
            style={{
              display: "flex",
              gap: 18,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <a href="/privacy-policy" className="footer-link">
              Privacy Policy
            </a>
            <a href="/terms-and-conditions" className="footer-link">
              Terms and Conditions
            </a>
            <a href="#security" className="footer-link">
              Security Compliance
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
