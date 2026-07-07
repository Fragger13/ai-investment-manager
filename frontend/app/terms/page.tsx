import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Use · AskPapa",
  description: "The terms for using AskPapa, a free educational money tool.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="July 2026">
      <p>
        Welcome to AskPapa. By creating an account or using the app at askpapa.in, you agree to these terms.
        Please read them. If you do not agree, please do not use AskPapa.
      </p>

      <h2>1. What AskPapa is</h2>
      <p>
        AskPapa is a <strong>free educational tool</strong> that helps you understand your money and shows
        general recommendations for you to consider. It is built to make learning about saving and investing
        simpler and friendlier.
      </p>

      <h2>2. Not investment advice</h2>
      <p>
        AskPapa is <strong>not investment, financial, legal, or tax advice</strong>, and it is not a
        SEBI registered investment adviser or a broker. Everything in the app is general information and
        education, not a personal recommendation to buy or sell any specific security. Investments carry risk,
        including the possible loss of capital, and past performance does not guarantee future returns. You are
        responsible for your own decisions, and you should verify details and consult a qualified professional
        before you invest.
      </p>

      <h2>3. Eligibility</h2>
      <p>You must be at least 18 years old and able to form a binding agreement to use AskPapa.</p>

      <h2>4. Your account</h2>
      <p>
        You are responsible for keeping your password safe and for activity on your account. Your financial data
        is encrypted with a key derived from your password, so please do not lose it. If you forget it, you can
        reset it, and we re-secure your data from a recovery mechanism. Tell us right away if you suspect
        unauthorized access.
      </p>

      <h2>5. Acceptable use</h2>
      <p>Please do not misuse AskPapa. In particular, do not:</p>
      <ul>
        <li>break the law or infringe anyone&apos;s rights while using it,</li>
        <li>try to access other users&apos; data or disrupt the service,</li>
        <li>scrape, resell, or redistribute the app or its content, or</li>
        <li>rely on it as your sole basis for a financial decision.</li>
      </ul>

      <h2>6. Data from other sources</h2>
      <p>
        AskPapa uses public market and news data and community sentiment to build its educational content. This
        data may be delayed, incomplete, or inaccurate, and is provided as is. Names of funds and instruments are
        used for factual reference only and do not imply any endorsement.
      </p>

      <h2>7. No warranty</h2>
      <p>
        AskPapa is provided <strong>as is</strong>, without warranties of any kind. We do not promise that it will
        be uninterrupted, error free, or that any figure, projection, or recommendation will be accurate or
        profitable.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the fullest extent allowed by law, AskPapa and its creator are not liable for any loss or damage,
        including investment losses, arising from your use of the app. AskPapa is free, and your use of it is at
        your own risk.
      </p>

      <h2>9. Ending your use</h2>
      <p>
        You can delete your account at any time from inside the app, which permanently erases your data. We may
        suspend or end access if these terms are broken.
      </p>

      <h2>10. Changes</h2>
      <p>We may update these terms as the app grows. Continued use after an update means you accept the new terms.</p>

      <h2>11. Governing law</h2>
      <p>These terms are governed by the laws of India, and disputes fall under the courts of India.</p>

      <h2>12. Contact</h2>
      <p>
        Questions about these terms? Email us at <a href="mailto:noreply@askpapa.in">noreply@askpapa.in</a>. See
        also our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
