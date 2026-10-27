import { Clock3, Mail, Phone, ShieldAlert } from "lucide-react";
import "./HelpSupportView.css";

const supportPhone = import.meta.env.VITE_SUPPORT_PHONE?.trim() ?? "";
const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL?.trim() ?? "";
const supportHours = import.meta.env.VITE_SUPPORT_HOURS?.trim() ?? "";
const emergencyPhone = import.meta.env.VITE_EMERGENCY_PHONE?.trim() ?? "";

function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function HelpSupportView() {
  return (
    <section className="support-page">
      <div className="support-heading">
        <span>VaultBank • Customer care</span>
        <h1>Help &amp; Support</h1>
        <p>Contact the bank using the support information configured for your deployment.</p>
      </div>

      <div className="support-cards">
        <article className="support-card">
          <Phone size={22} />
          <h2>Customer helpline</h2>
          {supportPhone ? (
            <a href={phoneHref(supportPhone)}>{supportPhone}</a>
          ) : (
            <p className="support-config">
              Not configured. Set <code>VITE_SUPPORT_PHONE</code> in the frontend environment.
            </p>
          )}
        </article>

        <article className="support-card">
          <Mail size={22} />
          <h2>Support email</h2>
          {supportEmail ? (
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          ) : (
            <p className="support-config">
              Not configured. Set <code>VITE_SUPPORT_EMAIL</code> in the frontend environment.
            </p>
          )}
        </article>

        <article className="support-card">
          <Clock3 size={22} />
          <h2>Working hours</h2>
          {supportHours ? (
            <p>{supportHours}</p>
          ) : (
            <p className="support-config">
              Not configured. Set <code>VITE_SUPPORT_HOURS</code> in the frontend environment.
            </p>
          )}
        </article>

        <article className="support-card">
          <ShieldAlert size={22} />
          <h2>Card emergency contact</h2>
          {emergencyPhone ? (
            <a href={phoneHref(emergencyPhone)}>{emergencyPhone}</a>
          ) : (
            <p className="support-config">
              Not configured. Set <code>VITE_EMERGENCY_PHONE</code> when an approved
              emergency number is available.
            </p>
          )}
        </article>
      </div>
      <p className="support-privacy">
        Internal employee messaging is not available to customer accounts. For
        urgent card issues, use only the official contact configured by VaultBank.
      </p>
    </section>
  );
}
