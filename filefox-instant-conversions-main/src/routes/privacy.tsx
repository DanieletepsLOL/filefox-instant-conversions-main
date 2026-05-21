import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Filefox — Privacy Policy" },
      { name: "description", content: "Learn how Filefox collects, uses, stores, and protects personal information when you use our file conversion services." },
      { property: "og:title", content: "Filefox — Privacy Policy" },
      { property: "og:description", content: "Learn how Filefox collects, uses, stores, and protects personal information when you use our file conversion services." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-16">
        <article className="max-w-4xl mx-auto space-y-8 text-gray-900">
          <header className="space-y-4">
            <h1 className="text-4xl font-bold">Privacy Policy</h1>
            <p className="text-sm text-gray-600">Last updated: May 20, 2026</p>
          </header>

          <section className="space-y-4">
            <h2 className="text-2xl">Introduction</h2>
            <p>Welcome to Filefox. We value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and protect information when you use our website and file conversion services.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">Information We Collect</h2>
            <p>We may collect certain types of information while you use Filefox, including:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Files uploaded for conversion purposes</li>
              <li>Basic browser and device information</li>
              <li>IP address and general location information</li>
              <li>Website usage statistics and analytics data</li>
              <li>Information provided when contacting support</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">How We Use Information</h2>
            <p>The information collected may be used for the following purposes:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>To provide and improve our file conversion services</li>
              <li>To maintain website functionality and security</li>
              <li>To prevent abuse, fraud, and unauthorized activity</li>
              <li>To improve user experience and website performance</li>
              <li>To respond to support requests and inquiries</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">File Processing</h2>
            <p>Files uploaded to Filefox are processed only for the purpose of completing requested conversions requested by users. Files may be stored temporarily while processing is completed and may be automatically deleted according to our retention policy and technical requirements.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">Cookies and Similar Technologies</h2>
            <p>Filefox may use cookies and similar technologies to improve website functionality, remember preferences, analyze website traffic, and enhance overall user experience.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">Third-Party Services</h2>
            <p>We may use third-party services including hosting providers, analytics tools, advertising services, security systems, and infrastructure providers necessary for operating the platform. These services may process limited information strictly required for their functionality.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">Data Security</h2>
            <p>We implement technical and organizational security measures designed to protect information from unauthorized access, disclosure, misuse, alteration, or destruction. However, no internet transmission or storage system can be guaranteed to be completely secure.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">User Rights</h2>
            <p>Depending on your location and applicable regulations, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Request access to personal information</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of certain data</li>
              <li>Object to certain processing activities</li>
              <li>Request additional information regarding your data</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Changes to This Privacy Policy</h2>
            <p>We may update this Privacy Policy from time to time to reflect changes in our services, technologies, legal requirements, or operational practices. Any modifications will be published on this page with an updated revision date.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">Company Information</h2>
            <p>Filefox is a product and brand developed by Brevia. Brevia develops digital products and services focused on performance, usability, and modern user experiences. References to Filefox throughout this Privacy Policy may also include related services, systems, technologies, and infrastructure provided under the Brevia ecosystem.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">Contact Information</h2>
            <p>If you have questions regarding this Privacy Policy or our data practices, please contact us:</p>
            <p className="font-medium">Email: support@filefox.com</p>
          </section>
        </article>
      </main>

      <Footer />
    </div>
  );
}
