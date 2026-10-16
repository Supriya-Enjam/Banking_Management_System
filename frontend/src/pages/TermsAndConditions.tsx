
import { Link } from "react-router-dom";
import "./TermsAndConditions.css";

export default function TermsAndConditions() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <Link to="/" className="legal-back-link">
          ← Back to VaultBank
        </Link>

        <header className="legal-header">
          <span className="legal-eyebrow">PLEASE READ CAREFULLY</span>
          <h1>Terms &amp; Conditions</h1>
          <p>
            These terms describe the rules and responsibilities
            associated with using VaultBank.
          </p>
          <span className="legal-updated">
            Last updated: October 16, 2026
          </span>
        </header>

        <article className="legal-content">
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using VaultBank, you agree to these Terms
              and Conditions. If you do not agree, you should stop
              using the application.
            </p>
          </section>

          <section>
            <h2>2. Purpose of the Application</h2>
            <p>
              VaultBank is a banking management system project intended
              to demonstrate features such as user authentication,
              account management, balances, and transaction workflows.
            </p>
            <p>
              Unless expressly stated otherwise in a separately authorized
              service agreement, VaultBank is not a bank, does not itself
              accept deposits, and does not provide real-world banking,
              investment, lending, or payment services.
            </p>
          </section>

          <section>
            <h2>3. User Accounts</h2>
            <p>When creating or using an account, you agree to:</p>
            <ul>
              <li>Provide accurate information where requested.</li>
              <li>Keep your login credentials confidential.</li>
              <li>Use only accounts you are authorized to access.</li>
              <li>Notify the administrator if you suspect unauthorized access.</li>
              <li>Keep your account information reasonably up to date.</li>
            </ul>
            <p>
              You are responsible for activity performed through your
              account to the extent permitted by applicable law.
            </p>
          </section>

          <section>
            <h2>4. Permitted Use</h2>
            <p>You must not:</p>
            <ul>
              <li>Attempt to access another user's account without permission.</li>
              <li>Interfere with the application's security or operation.</li>
              <li>Submit malicious code or attempt to exploit vulnerabilities.</li>
              <li>Use the application for unlawful or fraudulent activity.</li>
              <li>Misrepresent demonstration data as verified banking records.</li>
            </ul>
          </section>

          <section>
            <h2>5. Transactions and Account Balances</h2>
            <p>
              Transaction and balance features are limited to the
              functionality implemented in the application. In a
              demonstration environment, displayed balances and
              transactions may be simulated.
            </p>
            <p>
              A successful screen response does not establish that money
              has moved between real financial accounts. Do not rely on
              demonstration records as proof of payment or account ownership.
            </p>
          </section>

          <section>
            <h2>6. Security and Responsible Access</h2>
            <p>
              You must not share passwords, authentication tokens, or
              other access credentials. Do not attempt to bypass
              authentication, permissions, transaction limits, or
              other security controls.
            </p>
            <p>
              The application owner should configure appropriate
              authentication, authorization, validation, and monitoring
              before any real financial data or production service is used.
            </p>
          </section>

          <section>
            <h2>7. Availability and Changes</h2>
            <p>
              Features may change, be temporarily unavailable, or be
              removed as the project develops. We do not guarantee
              uninterrupted availability unless a separate agreement
              expressly provides otherwise.
            </p>
          </section>

          <section>
            <h2>8. Intellectual Property</h2>
            <p>
              Unless otherwise stated, the application's original
              interface, branding, and project materials belong to their
              respective owners. You may not use protected materials
              without permission where permission is required.
            </p>
          </section>

          <section>
            <h2>9. Third-Party Services</h2>
            <p>
              VaultBank may rely on third-party libraries, hosting,
              authentication providers, or other services. Those services
              may be subject to their own terms and privacy policies.
            </p>
          </section>

          <section>
            <h2>10. Disclaimer and Limitation</h2>
            <p>
              To the extent permitted by applicable law, the application
              is provided on an "as is" and "as available" basis without
              guarantees that every feature will be error-free or suitable
              for a particular purpose.
            </p>
            <p>
              Nothing in these terms excludes or limits a right or
              liability that cannot lawfully be excluded or limited.
              Any limitation of liability must be reviewed for the
              jurisdiction where the service is operated.
            </p>
          </section>

          <section>
            <h2>11. Suspension or Termination</h2>
            <p>
              Access may be restricted or suspended when reasonably
              necessary to protect the application, investigate misuse,
              maintain security, or comply with applicable law.
            </p>
          </section>

          <section>
            <h2>12. Changes to These Terms</h2>
            <p>
              These terms may be revised as the application evolves.
              Updated terms should be published with a revised date.
              Continued use after changes take effect may constitute
              acceptance where permitted by applicable law.
            </p>
          </section>

          <section>
            <h2>13. Governing Law</h2>
            <p>
              The governing law and dispute-resolution process must be
              specified by the service owner based on the applicable
              jurisdiction. Nothing in these terms removes any mandatory
              legal protections that apply to you.
            </p>
          </section>

          <section>
            <h2>14. Contact</h2>
            <p>
              For questions about these terms, contact the VaultBank
              project administrator through the official contact channel
              provided with your deployment.
            </p>
          </section>
        </article>

        <footer className="legal-footer">
          <span>© {new Date().getFullYear()} VaultBank</span>
          <nav aria-label="Legal pages">
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms-and-conditions">Terms &amp; Conditions</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
