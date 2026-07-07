import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy · AskPapa",
  description: "How AskPapa handles your data: encrypted, never sold, and yours to delete.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="July 2026">
      <p>
        Your money is personal, and your data should be too. This policy explains what AskPapa collects, how it is
        protected, and the control you have over it. In short: <strong>your financial data is encrypted, it is
        never sold, and you can delete it at any time.</strong>
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your name, email, and a securely hashed password.</li>
        <li><strong>Financial profile:</strong> the income, expenses, goals, and holdings you choose to enter.</li>
        <li><strong>Usage:</strong> basic technical information needed to run and secure the service.</li>
      </ul>
      <p>You decide what to share. You can use most of the app with only the details you are comfortable giving.</p>

      <h2>2. How we use it</h2>
      <p>
        We use your data only to run AskPapa for you: to build your dashboard, plan, and recommendations, and to
        send essential emails such as verification and password resets. That is it.
      </p>

      <h2>3. How it is protected</h2>
      <p>
        Your financial data is <strong>encrypted with a key derived from your password</strong>. The key unlocks
        your data only for the length of each request. Open the database directly and you find ciphertext, which
        means <strong>even the person running AskPapa cannot read your financial data</strong>. This is a property
        of the system, not just a promise.
      </p>

      <h2>4. What we do not do</h2>
      <ul>
        <li>We do not sell or rent your data to anyone.</li>
        <li>We do not show you third-party ads.</li>
        <li>We do not use your financial data to train external AI models.</li>
      </ul>

      <h2>5. Service providers</h2>
      <p>
        A few trusted services help run AskPapa: hosting for the app and database, an email provider for
        verification and reset emails, and a language model that rewrites already computed answers in Papa&apos;s
        voice. Providers only ever receive what is needed to do their job.
      </p>

      <h2>6. Your rights</h2>
      <p>You are in control of your data. You can:</p>
      <ul>
        <li><strong>Access and correct it</strong> by editing your profile in the app,</li>
        <li><strong>Delete everything</strong> using Delete account, which permanently erases your account and all your data, and</li>
        <li><strong>Ask us questions</strong> about your data at any time.</li>
      </ul>

      <h2>7. Data retention</h2>
      <p>We keep your data only while your account is active. When you delete your account, your data is removed for good.</p>

      <h2>8. Children</h2>
      <p>AskPapa is for adults aged 18 and over and is not directed at children.</p>

      <h2>9. Changes</h2>
      <p>If this policy changes in a meaningful way, we will update this page and the date above.</p>

      <h2>10. Contact</h2>
      <p>
        For any privacy question or data request, email <a href="mailto:support@askpapa.in">support@askpapa.in</a>.
        See also our <Link href="/terms">Terms of Use</Link>.
      </p>
    </LegalPage>
  );
}
