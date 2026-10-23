import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  FileText,
  Landmark,
  LockKeyhole,
  Mail,
  Menu,
  Phone,
  ReceiptText,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wallet,
  X,
  Zap,
  Clock3,
} from "lucide-react";
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaYoutube,
} from "react-icons/fa";
import type { Customer } from "../services/api";
import "../LandingPage.css";

interface LandingPageProps {
  customer: Customer | null;
  onOpenAuth: (isRegister?: boolean) => void;
  onQuickDemoLogin: (email: string, pass: string) => void;
  onEnterDashboard: () => void;
}

const features = [
  {
    icon: Wallet,
    title: "Account management",
    description:
      "View and manage your supported bank accounts from one dashboard.",
  },
  {
    icon: ArrowDownToLine,
    title: "Deposits & withdrawals",
    description:
      "Use the available deposit and withdrawal workflows for your accounts.",
  },
  {
    icon: ArrowLeftRight,
    title: "Fund transfers",
    description:
      "Transfer funds between accounts with balance and transaction checks.",
  },
  {
    icon: ReceiptText,
    title: "Transaction history",
    description:
      "Review account activity and access ledger-style transaction records.",
  },
  {
    icon: UsersRound,
    title: "Beneficiary management",
    description:
      "Manage saved beneficiaries for the transfer workflows available to you.",
  },
  {
    icon: Landmark,
    title: "Loans & fixed deposits",
    description:
      "Submit loan applications and manage fixed deposits through the app.",
  },
  {
    icon: FileText,
    title: "Statements & receipts",
    description:
      "View transaction receipts and account statements in the dashboard.",
  },
  {
    icon: Bell,
    title: "Notifications",
    description:
      "Keep track of account updates and activity notifications in one place.",
  },
];

const securityItems = [
  {
    icon: LockKeyhole,
    title: "Secure authentication",
    description:
      "Sign in through the application’s authentication flow to access your account.",
  },
  {
    icon: UsersRound,
    title: "Role-based access",
    description:
      "Customer, staff, and administrative experiences are organized around their roles.",
  },
  {
    icon: ShieldCheck,
    title: "Transaction validation",
    description:
      "Transaction workflows check account and transfer details before processing.",
  },
  {
    icon: Bell,
    title: "Activity awareness",
    description:
      "Review transaction history, notifications, and available account activity tools.",
  },
];

const steps = [
  {
    number: "01",
    title: "Sign in or register",
    description:
      "Create an account or sign in through VaultBank’s existing authentication flow.",
  },
  {
    number: "02",
    title: "Manage your banking",
    description:
      "Use your dashboard to view accounts and access available banking workflows.",
  },
  {
    number: "03",
    title: "Stay informed",
    description:
      "Review transactions, statements, and notifications as you manage your finances.",
  },
];

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  { label: "Services", href: "#services" },
  { label: "About us", href: "#about" },
  { label: "Contact", href: "#contact" },
];

const socialLinks = [
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/",
    icon: FaLinkedinIn,
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/",
    icon: FaInstagram,
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/",
    icon: FaFacebookF,
  },
  {
    name: "X",
    href: "https://x.com/",
    icon: null,
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/",
    icon: FaYoutube,
  },
];

const currentYear = new Date().getFullYear();

export const LandingPage = ({
  customer,
  onOpenAuth,
  onQuickDemoLogin,
  onEnterDashboard,
}: LandingPageProps) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleNavClick = () => setMenuOpen(false);

  const handleGetStarted = () => {
    if (customer) {
      onEnterDashboard();
      return;
    }
    onOpenAuth(true);
  };

  return (
    <div className="landing-wrapper">
      <header className="landing-header">
        <nav className="landing-nav" aria-label="Main navigation">
          <a
            className="landing-brand"
            href="#home"
            onClick={handleNavClick}
            aria-label="VaultBank home"
          >
            <span className="landing-brand-icon" aria-hidden="true">
              <Landmark size={19} strokeWidth={2.2} />
            </span>
            <span>VaultBank</span>
          </a>

          <button
            className="landing-menu-toggle"
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="landing-navigation-links"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>

          <div
            className={`landing-nav-content${menuOpen ? " is-open" : ""}`}
            id="landing-navigation-links"
          >
            <div className="landing-nav-links">
              {navLinks.map((link) => (
                <a
                  className="landing-nav-link"
                  href={link.href}
                  key={link.href}
                  onClick={handleNavClick}
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="landing-nav-actions">
              {customer ? (
                <button
                  className="landing-button landing-button-primary landing-nav-cta"
                  type="button"
                  onClick={onEnterDashboard}
                >
                  Go to dashboard <ArrowRight size={16} />
                </button>
              ) : (
                <>
                  <button
                    className="landing-button landing-button-quiet"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenAuth(false);
                    }}
                  >
                    Login
                  </button>
                  <button
                    className="landing-button landing-button-primary landing-nav-cta"
                    type="button"
                    onClick={handleGetStarted}
                  >
                    Get started <ArrowRight size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        </nav>
      </header>

      <main>
        <section className="landing-hero" id="home">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow">
              <span className="landing-eyebrow-mark" aria-hidden="true" />
              Banking, built around you
            </div>
            <h1>
              Banking made simple.
              <br />
              <span>Your future, thoughtfully managed.</span>
            </h1>
            <p className="landing-hero-description">
              A clearer way to manage your accounts, move money, and keep track
              of your banking — all from one convenient place.
            </p>
            <div className="landing-hero-actions">
              <button
                className="landing-button landing-button-primary landing-button-large"
                type="button"
                onClick={handleGetStarted}
              >
                {customer ? "Go to dashboard" : "Get started"}
                <ArrowRight size={17} />
              </button>
              <a
                className="landing-button landing-button-outline landing-button-large"
                href="#features"
              >
                Explore features
                <ChevronDown size={17} />
              </a>
            </div>
            <div className="landing-hero-assurance">
              <span>
                <Check size={15} aria-hidden="true" />
                Clear account overview
              </span>
              <span>
                <Check size={15} aria-hidden="true" />
                Convenient digital tools
              </span>
            </div>
            {!customer && (
              <button
                className="landing-demo-link"
                type="button"
                onClick={() =>
                  onQuickDemoLogin(
                    "demo.customer@example.com",
                    "Demo@12345"
                  )
                }
              >
                <Zap size={14} />
                Try the customer demo
              </button>
            )}
          </div>

          <div className="landing-hero-visual" aria-label="VaultBank dashboard preview">
            <div className="landing-preview-orbit landing-preview-orbit-one" />
            <div className="landing-preview-orbit landing-preview-orbit-two" />
            <div className="landing-dashboard-preview">
              <div className="landing-preview-topbar">
                <div className="landing-preview-brand">
                  <span className="landing-preview-brand-icon">
                    <Landmark size={15} />
                  </span>
                  <span>VaultBank</span>
                </div>
                <span className="landing-preview-avatar" aria-hidden="true">
                  <UserRound size={16} />
                </span>
              </div>
              <div className="landing-preview-welcome">
                <span>YOUR BANKING, IN ONE PLACE</span>
                <h2>Account overview</h2>
                <p>A simple view of your banking tools.</p>
              </div>
              <div className="landing-preview-summary">
                <div>
                  <span>Accounts</span>
                  <strong>Manage accounts</strong>
                </div>
                <span className="landing-preview-summary-icon">
                  <Wallet size={18} />
                </span>
              </div>
              <div className="landing-preview-quicklinks">
                <div>
                  <span className="landing-preview-quick-icon">
                    <ArrowLeftRight size={17} />
                  </span>
                  <span>Transfers</span>
                </div>
                <div>
                  <span className="landing-preview-quick-icon">
                    <ReceiptText size={17} />
                  </span>
                  <span>Statements</span>
                </div>
                <div>
                  <span className="landing-preview-quick-icon">
                    <Bell size={17} />
                  </span>
                  <span>Activity</span>
                </div>
              </div>
              <div className="landing-preview-caption">
                <span className="landing-caption-dot" />
                Interface preview · no account data shown
              </div>
            </div>
            <div className="landing-preview-note">
              <span className="landing-preview-note-icon">
                <ShieldCheck size={19} />
              </span>
              <span>
                <strong>Made for everyday banking</strong>
                <small>Tools and activity, side by side</small>
              </span>
            </div>
          </div>
        </section>

        <section className="landing-features-section" id="services">
          <div className="landing-section-heading" id="features">
            <span className="landing-section-kicker">Banking services</span>
            <h2>Everything you need, in one place.</h2>
            <p>
              Practical tools to help you manage accounts and everyday banking
              tasks with confidence.
            </p>
          </div>
          <div className="landing-features-grid">
            {features.map(({ icon: Icon, title, description }) => (
              <article className="landing-feature-card" key={title}>
                <span className="landing-feature-icon" aria-hidden="true">
                  <Icon size={21} strokeWidth={1.8} />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-about-section" id="about">
          <div className="landing-about-intro">
            <span className="landing-section-kicker">Designed with care</span>
            <h2>Banking tools that put clarity first.</h2>
            <p>
              VaultBank brings account tasks and activity into a single
              experience, with access and workflows tailored to each role.
            </p>
            <a className="landing-text-link" href="#how-it-works">
              See how it works <ArrowRight size={16} />
            </a>
          </div>
          <div className="landing-security-grid">
            {securityItems.map(({ icon: Icon, title, description }) => (
              <article className="landing-security-item" key={title}>
                <span className="landing-security-icon" aria-hidden="true">
                  <Icon size={19} strokeWidth={1.8} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-steps-section" id="how-it-works">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">A simple start</span>
            <h2>Three steps to get going.</h2>
            <p>Get started with your account and find your way around.</p>
          </div>
          <div className="landing-steps-grid">
            {steps.map((step) => (
              <article className="landing-step" key={step.number}>
                <span className="landing-step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-cta-section" id="contact">
          <div className="landing-cta-content">
            <span className="landing-section-kicker">A better banking routine starts here</span>
            <h2>Ready to make banking feel simpler?</h2>
            <p>
              Create your VaultBank account to explore the banking tools
              available to you.
            </p>
          </div>
          <button
            className="landing-button landing-button-light landing-button-large"
            type="button"
            onClick={handleGetStarted}
          >
            {customer ? "Go to dashboard" : "Create your account"}
            <ArrowRight size={17} />
          </button>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-main">
          <div className="landing-footer-brand">
            <a className="landing-brand" href="#home" aria-label="VaultBank home">
              <span className="landing-brand-icon" aria-hidden="true">
                <Landmark size={19} strokeWidth={2.2} />
              </span>
              <span>VaultBank</span>
            </a>
            <p>
              A thoughtful digital banking experience for managing accounts,
              transactions, and more.
            </p>
          </div>
          <div className="landing-footer-column">
            <h2>Explore</h2>
            <a href="#home">Home</a>
            <a href="#features">Features</a>
            <a href="#services">Services</a>
            <a href="#about">About us</a>
          </div>
          <div className="landing-footer-column">
            <h2>Banking tools</h2>
            <a href="#features">Account management</a>
            <a href="#features">Fund transfers</a>
            <a href="#features">Loans & fixed deposits</a>
            <a href="#features">Statements & receipts</a>
          </div>
          <div className="landing-footer-column">
            <h2>Get started</h2>
            <button type="button" onClick={handleGetStarted}>
              Create an account
            </button>
            <button type="button" onClick={() => onOpenAuth(false)}>
              Login
            </button>
            <a href="/privacy-policy">Privacy policy</a>
            <a href="/terms-and-conditions">Terms & conditions</a>
          </div>
          <div className="landing-footer-community">
            <section className="landing-footer-support" aria-labelledby="landing-footer-support-title">
              <h2 id="landing-footer-support-title">Need help?</h2>
              <a
                className="landing-footer-contact-link"
                href="tel:1800XXXXXXX"
                aria-label="Call customer support at 1800-XXX-XXXX"
              >
                <Phone size={15} aria-hidden="true" />
                <span>1800-XXX-XXXX</span>
              </a>
              <a
                className="landing-footer-contact-link"
                href="mailto:example@gmail.com"
                aria-label="Email customer support at example@gmail.com"
              >
                <Mail size={15} aria-hidden="true" />
                <span>example@gmail.com</span>
              </a>
              <p className="landing-footer-hours">
                <Clock3 size={15} aria-hidden="true" />
                <span>Available 24/7</span>
              </p>
            </section>
            <section className="landing-footer-follow" aria-labelledby="landing-footer-follow-title">
              <h2 id="landing-footer-follow-title">Follow Us</h2>
              <div className="landing-footer-social-links">
                {socialLinks.map(({ name, href, icon: Icon }) => (
                  <a
                    key={name}
                    className="landing-footer-social-link"
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Visit VaultBank on ${name}`}
                    title={name}
                  >
                    {Icon ? (
                      <Icon size={17} aria-hidden="true" />
                    ) : (
                      <span className="landing-footer-x-icon" aria-hidden="true">
                        𝕏
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </section>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>© {currentYear} VaultBank. All rights reserved.</span>
          <a href="#about">Security & account access</a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
