
import { Link } from "react-router-dom";
import "./PrivacyPolicy.css";

export default function PrivacyPolicy() {
  return (
    <main className="legal-page">
      <div className="legal-container">
        <Link to="/" className="legal-back-link">
          ← Back to VaultBank
        </Link>

        <header className="legal-header">
          <span className="legal-eyebrow">YOUR PRIVACY MATTERS</span>
          <h1>Privacy Policy</h1>
          <p>
            Learn how VaultBank handles your information and works
            to protect your privacy.
          </p>
          <span className="legal-updated">
            Last updated: October 16, 2026
          </span>
        </header>

        <article className="legal-content">
          <section>
            <h2>1. Introduction</h2>
            <p>
              Welcome to VaultBank. This Privacy Policy explains how
              information may be collected, used, stored, and protected
              when you use our banking management application.
            </p>
            <p>
              VaultBank is a banking management system project. Unless
              it is connected to authorized financial institutions and
              appropriate banking infrastructure, it should not be
              considered a real banking service.
            </p>
          </section>

          <section>
            <h2>2. Information We May Collect</h2>
            <p>Depending on the features you use, the application may process:</p>
            <ul>
              <li>
                <strong>Account information:</strong> Name, email address,
                and other details you provide when registering.
              </li>
              <li>
                <strong>Authentication information:</strong> Information
                used to verify your identity and manage your login session.
              </li>
              <li>
                <strong>Account and transaction data:</strong> Demonstration
                account balances, transaction records, and other data entered
                or generated within the application.
              </li>
              <li>
                <strong>Technical information:</strong> Basic diagnostic
                information necessary to operate, secure, and troubleshoot
                the application, where collected.
              </li>
            </ul>
            <p>
              We should collect only the information needed for the
              application's intended functionality.
            </p>
          </section>

          <section>
            <h2>3. How Information Is Used</h2>
            <p>Information may be used to:</p>
            <ul>
              <li>Create and manage user accounts.</li>
              <li>Authenticate users and maintain secure sessions.</li>
              <li>Display account information and transaction history.</li>
              <li>Process authorized operations supported by the application.</li>
              <li>Identify errors, prevent misuse, and improve functionality.</li>
              <li>Respond to user support requests.</li>
            </ul>
          </section>

          <section>
            <h2>4. Data Storage and Security</h2>
            <p>
              VaultBank should use appropriate safeguards to help protect
              information against unauthorized access, alteration, loss,
              or disclosure.
            </p>
            <p>
              Security measures may include access controls, authentication,
              secure configuration, and protected communications where
              implemented. No application or method of electronic storage
              can guarantee absolute security.
            </p>
            <p>
              Do not enter real banking credentials, PINs, card security
              codes, or other sensitive financial information into a
              demonstration environment.
            </p>
          </section>

          <section>
            <h2>5. Sharing of Information</h2>
            <p>
              Personal information should not be sold. Information may be
              shared only where necessary to operate the service, protect
              users, comply with applicable law, or respond to valid legal
              requests.
            </p>
            <p>
              If third-party services are added, their role and relevant
              privacy practices should be disclosed before the service
              is used with real personal information.
            </p>
          </section>

          <section>
            <h2>6. Cookies and Local Storage</h2>
            <p>
              The application may use browser storage to remember settings,
              such as your selected theme, or to support application
              functionality. Browser storage is not necessarily shared
              across devices and may be cleared through your browser.
            </p>
          </section>

          <section>
            <h2>7. Data Retention and Deletion</h2>
            <p>
              Information should be retained only for as long as reasonably
              necessary for the purposes described in this policy or as
              required by applicable law.
            </p>
            <p>
              The available process for accessing, correcting, or deleting
              information depends on the features actually implemented
              in VaultBank.
            </p>
          </section>

          <section>
            <h2>8. Your Privacy Rights</h2>
            <p>
              Depending on applicable law, you may have rights to request
              access to, correction of, or deletion of personal information,
              or to raise concerns about how it is handled.
            </p>
            <p>
              Requests should be directed to the service administrator
              using the contact details provided by the project owner.
            </p>
          </section>

          <section>
            <h2>9. Children's Privacy</h2>
            <p>
              VaultBank is not intended to collect children's personal
              information unlawfully. If you believe a child has provided
              personal information inappropriately, contact the service
              administrator.
            </p>
          </section>

          <section>
            <h2>10. Changes to This Policy</h2>
            <p>
              This policy may be updated as the application develops.
              Material changes should be reflected on this page with
              an updated revision date.
            </p>
          </section>

          <section>
            <h2>11. Contact</h2>
            <p>
              For privacy-related questions, contact the VaultBank
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
