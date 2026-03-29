import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | [PRODUCT_NAME] Assistant",
  description:
    "Terms of Service for [PRODUCT_NAME] Assistant — AI-powered clinical documentation platform.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-primary hover:underline">
            &larr; Back to [PRODUCT_NAME]
          </Link>
          <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
            Privacy Policy
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <article className="prose dark:prose-invert max-w-none">
          <h1>Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: March 2026</p>

          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of [PRODUCT_NAME]
            Assistant (&quot;Service&quot;), operated by [PRODUCT_NAME] (&quot;Company,&quot;
            &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By accessing or using the
            Service, you agree to be bound by these Terms. If you do not agree, do not use the
            Service.
          </p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By creating an account, subscribing to a plan, or otherwise using [PRODUCT_NAME] Assistant,
            you confirm that you have read, understood, and agree to these Terms. If you are
            using the Service on behalf of a clinical practice or organization, you represent
            that you have authority to bind that organization to these Terms.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            [PRODUCT_NAME] Assistant is an AI-powered clinical documentation platform. The Service
            records voice encounters, extracts clinical facts, and generates documents
            including SOAP notes, client summaries, discharge instructions, referral letters,
            prescriptions, follow-up plans, and lab requests. The Service also provides an
            &quot;Patient Companion&quot; feature that shares post-visit information with
            patients via temporary links.
          </p>
          <p>
            <strong>
              [PRODUCT_NAME] Assistant is a documentation and clinical reasoning support tool. It is not
              a replacement for professional clinical judgment, diagnosis, or treatment
              decisions.
            </strong>{" "}
            All AI-generated content must be reviewed, verified, and approved by a licensed
            clinical professional before use in clinical practice.
          </p>

          <h2>3. User Accounts and Organizations</h2>
          <p>
            You must create an account to use the Service. You are responsible for maintaining
            the confidentiality of your account credentials and for all activity that occurs
            under your account. You agree to provide accurate and current information during
            registration.
          </p>
          <p>
            Organization accounts allow multiple team members to collaborate under a shared
            practice. Organization administrators are responsible for managing member access
            and permissions.
          </p>

          <h2>4. Subscription and Billing</h2>
          <p>
            [PRODUCT_NAME] Assistant is offered as a subscription service with the following plans:
          </p>
          <ul>
            <li><strong>Solo</strong> &mdash; $79/month, for individual practitioners</li>
            <li><strong>Practice</strong> &mdash; $149/month, for single-location practices</li>
            <li><strong>Multi-Location</strong> &mdash; $299/month, for multi-site organizations</li>
          </ul>
          <p>
            Payments are processed through Stripe. By subscribing, you authorize us to charge
            your payment method on a recurring basis. You may cancel your subscription at any
            time through your account settings. Cancellation takes effect at the end of the
            current billing period. Refunds are not provided for partial billing periods unless
            required by applicable law.
          </p>

          <h2>5. Acceptable Use</h2>
          <p>
            The Service is intended for use by licensed clinical professionals and their
            authorized staff. You agree to:
          </p>
          <ul>
            <li>Use the Service only for lawful clinical documentation and clinical support purposes</li>
            <li>Not use the Service for human medical diagnosis, treatment, or documentation</li>
            <li>Not upload or transmit content that is unlawful, harmful, or infringes on the rights of others</li>
            <li>Not attempt to reverse-engineer, decompile, or disassemble any part of the Service</li>
            <li>Not share your account credentials with unauthorized individuals</li>
            <li>Not use the Service in a manner that could damage, disable, or impair the platform</li>
          </ul>

          <h2>6. AI-Generated Content Disclaimer</h2>
          <p>
            [PRODUCT_NAME] Assistant uses artificial intelligence to transcribe encounters, extract
            clinical facts, and generate clinical documents. While we strive for accuracy,
            AI-generated content may contain errors, omissions, or inaccuracies.
          </p>
          <p>
            <strong>
              AI-generated outputs do not constitute clinical medical advice, diagnosis, or
              treatment recommendations.
            </strong>{" "}
            You are solely responsible for reviewing, editing, and approving all AI-generated
            content before incorporating it into patient records or clinical decisions. The
            Company is not liable for any clinical outcomes resulting from reliance on
            AI-generated content without proper professional review.
          </p>

          <h2>7. Intellectual Property</h2>
          <p>
            The Service, including its software, design, features, and documentation, is owned
            by [PRODUCT_NAME] and protected by intellectual property laws. Your subscription grants you
            a limited, non-exclusive, non-transferable license to use the Service for its
            intended purpose.
          </p>
          <p>
            You retain ownership of the clinical data and encounter content you input into
            the Service. By using the Service, you grant us a limited license to process your
            content as necessary to provide and improve the Service.
          </p>

          <h2>8. Data and Privacy</h2>
          <p>
            Your use of the Service is also governed by our{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            , which describes how we collect, use, and protect your data. By using the Service,
            you consent to the data practices described in the Privacy Policy.
          </p>

          <h2>9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, [PRODUCT_NAME] and its officers,
            directors, employees, and agents shall not be liable for any indirect, incidental,
            special, consequential, or punitive damages, including but not limited to loss of
            profits, data, or goodwill, arising from or related to your use of the Service.
          </p>
          <p>
            Our total liability for any claim arising from or related to the Service shall not
            exceed the amount you paid to us in the twelve (12) months preceding the claim.
          </p>
          <p>
            The Service is provided &quot;as is&quot; and &quot;as available&quot; without
            warranties of any kind, whether express or implied, including but not limited to
            implied warranties of merchantability, fitness for a particular purpose, and
            non-infringement.
          </p>

          <h2>10. Termination</h2>
          <p>
            We may suspend or terminate your access to the Service at any time if you violate
            these Terms or engage in conduct that we determine, in our sole discretion, is
            harmful to the Service or other users. You may terminate your account at any time
            by contacting us or through your account settings.
          </p>
          <p>
            Upon termination, your right to use the Service ceases immediately. We may retain
            your data for a reasonable period in accordance with our Privacy Policy and
            applicable law.
          </p>

          <h2>11. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will notify you of
            material changes by posting the updated Terms on the Service and updating the
            &quot;Last updated&quot; date. Your continued use of the Service after changes
            become effective constitutes acceptance of the revised Terms.
          </p>

          <h2>12. Contact Information</h2>
          <p>If you have questions about these Terms, please contact us at:</p>
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
