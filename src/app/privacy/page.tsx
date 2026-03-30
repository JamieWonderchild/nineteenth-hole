import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | [PRODUCT_NAME] Assistant",
  description:
    "Privacy Policy for [PRODUCT_NAME] Assistant — AI-powered clinical documentation platform.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-primary hover:underline">
            &larr; Back to [PRODUCT_NAME]
          </Link>
          <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
            Terms of Service
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <article className="prose dark:prose-invert max-w-none">
          <h1>Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: March 2026</p>

          <p>
            This Privacy Policy describes how [PRODUCT_NAME] (&quot;Company,&quot; &quot;we,&quot;
            &quot;us,&quot; or &quot;our&quot;) collects, uses, and protects information when
            you use [PRODUCT_NAME] Assistant (&quot;Service&quot;). By using the Service, you consent to
            the data practices described in this policy.
          </p>

          <h2>1. Information We Collect</h2>

          <h3>Account Information</h3>
          <p>
            When you create an account, we collect your name, email address, professional
            credentials, and practice or organization details. Authentication is managed through
            Clerk, our identity provider.
          </p>

          <h3>Encounter and Clinical Data</h3>
          <p>
            The Service processes audio recordings of clinical encounters, transcribed
            text, extracted clinical facts (patient history, symptoms, examination findings,
            diagnoses, treatments), and AI-generated documents such as SOAP notes, patient
            summaries, discharge instructions, referral letters, prescriptions, follow-up
            plans, and lab requests.
          </p>

          <h3>Usage Data</h3>
          <p>
            We collect information about how you interact with the Service, including pages
            visited, features used, encounter frequency, and device and browser information.
          </p>

          <h3>Billing Information</h3>
          <p>
            Payment details are collected and processed by Stripe, our payment processor. We do
            not store full credit card numbers on our servers.
          </p>

          <h2>2. How We Use Information</h2>
          <ul>
            <li><strong>Service delivery:</strong> Processing encounters, generating documents, and providing the core AI-assisted documentation functionality</li>
            <li><strong>AI processing:</strong> Sending encounter audio and text to our AI provider (Corti) for transcription, clinical fact extraction, and document generation</li>
            <li><strong>Authentication:</strong> Verifying your identity and managing account access</li>
            <li><strong>Billing:</strong> Processing subscription payments and managing your plan</li>
            <li><strong>Analytics:</strong> Understanding usage patterns to improve the Service</li>
            <li><strong>Communication:</strong> Sending account-related notifications and service updates</li>
          </ul>

          <h2>3. Data Processing and Third-Party Services</h2>
          <p>We use the following third-party services to operate [PRODUCT_NAME] Assistant:</p>
          <ul>
            <li><strong>Corti AI:</strong> Processes encounter audio for transcription, clinical fact extraction, and document generation. Encounter data is sent to Corti&apos;s API for real-time processing.</li>
            <li><strong>Clerk:</strong> Manages user authentication, account creation, and session management.</li>
            <li><strong>Stripe:</strong> Processes subscription payments and billing. Stripe receives only the payment information necessary to complete transactions.</li>
            <li><strong>Convex:</strong> Provides cloud database infrastructure where encounter records, patient data, and generated documents are stored.</li>
          </ul>
          <p>
            Each third-party provider processes data in accordance with their own privacy
            policies and data processing agreements. We select providers that maintain
            appropriate security standards for handling sensitive data.
          </p>

          <h2>4. Data Sharing</h2>
          <p>
            We do not sell your personal information or clinical data. We share data only with
            the service providers listed above, and only to the extent necessary to operate the
            Service. We may also disclose information if required by law or to protect the
            rights, safety, or property of [PRODUCT_NAME], our users, or others.
          </p>

          <h2>5. Patient Companion Data</h2>
          <p>
            The Patient Companion feature allows clinical professionals to share post-visit
            information with patients through temporary, unique links. When a companion link
            is created:
          </p>
          <ul>
            <li>A summary of the visit, including patient name and relevant care information, is made accessible via the link</li>
            <li>Patients can interact with an AI chat assistant to ask questions about their visit</li>
            <li>Companion sessions are temporary and the clinical professional controls when links are active</li>
            <li>Patients do not need to create an account to access companion links</li>
            <li>We do not collect personal information from patients beyond what is inherent in their chat interactions</li>
          </ul>

          <h2>6. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your data,
            including:
          </p>
          <ul>
            <li>Encryption of data in transit using TLS/SSL</li>
            <li>Access controls and authentication requirements for all data access</li>
            <li>Organization-scoped data isolation to prevent cross-practice data access</li>
            <li>Regular security reviews of our infrastructure and third-party integrations</li>
          </ul>
          <p>
            While we strive to protect your data, no method of electronic transmission or
            storage is completely secure. We cannot guarantee absolute security.
          </p>

          <h2>7. Data Retention</h2>
          <p>
            We retain your encounter data and generated documents for as long as your
            account is active. Upon account termination, we will retain your data for a
            reasonable period to comply with legal obligations, resolve disputes, and enforce
            our agreements. You may request deletion of your data at any time (see Your Rights
            below).
          </p>

          <h2>8. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of the personal and clinical data we hold about you</li>
            <li><strong>Correction:</strong> Request correction of inaccurate data</li>
            <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
            <li><strong>Export:</strong> Request an export of your data in a portable format</li>
            <li><strong>Restriction:</strong> Request that we limit how we process your data in certain circumstances</li>
          </ul>
          <p>
            To exercise any of these rights, please contact us at{" "}
            <a href="mailto:legal@[PRODUCT_NAME_DOMAIN]" className="text-primary hover:underline">
              legal@[PRODUCT_NAME_DOMAIN]
            </a>
            . We will respond to requests within 30 days.
          </p>

          <h2>9. Children&apos;s Privacy</h2>
          <p>
            [PRODUCT_NAME] Assistant is designed for use by clinical professionals and is not directed
            at children under the age of 16. We do not knowingly collect personal information
            from children. If you believe a child has provided us with personal information,
            please contact us and we will take steps to delete it.
          </p>

          <h2>10. Clinical Data & HIPAA</h2>
          <p>
            [PRODUCT_NAME] Assistant processes human clinical data, including protected health
            information (PHI) as defined by the Health Insurance Portability and Accountability
            Act (HIPAA). We maintain technical, administrative, and physical safeguards consistent
            with HIPAA requirements. Healthcare providers using the Service are responsible for
            ensuring their use complies with applicable HIPAA obligations, including executing a
            Business Associate Agreement (BAA) with us where required.
          </p>
          <p>
            Clinical professionals are responsible for complying with all applicable federal and
            state regulations regarding patient medical records, data retention, and privacy.
          </p>

          <h2>11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material
            changes by posting the updated policy on the Service and updating the &quot;Last
            updated&quot; date. Your continued use of the Service after changes become effective
            constitutes acceptance of the revised policy.
          </p>

          <h2>12. Contact Information</h2>
          <p>
            If you have questions or concerns about this Privacy Policy or our data practices,
            please contact us at:
          </p>
          <p>
            <strong>Email:</strong>{" "}
            <a href="mailto:legal@[PRODUCT_NAME_DOMAIN]" className="text-primary hover:underline">
              legal@[PRODUCT_NAME_DOMAIN]
            </a>
          </p>
        </article>
      </main>

      <footer className="border-t border-border bg-muted/50">
        <div className="mx-auto max-w-3xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>&copy; 2026 [PRODUCT_NAME]. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
