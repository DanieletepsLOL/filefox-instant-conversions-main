import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Filefox — Terms of Service" },
      { name: "description", content: "Read the terms that govern your use of Filefox, including responsibilities, prohibited uses, and limitations." },
      { property: "og:title", content: "Filefox — Terms of Service" },
      { property: "og:description", content: "Read the terms that govern your use of Filefox, including responsibilities, prohibited uses, and limitations." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 md:px-6 py-16">
        <article className="max-w-4xl mx-auto space-y-8 text-foreground">
          <header className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
            <p className="text-sm text-foreground/80">Last updated: May 20, 2026</p>
          </header>

          <section className="space-y-4">
            <h2 className="text-2xl">Introduction</h2>
            <p>These Terms of Service govern your use of Filefox, a file conversion platform operated as part of the Brevia ecosystem. By accessing or using Filefox, you agree to be bound by these terms. If you do not agree, you must stop using the service.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">Description of Service</h2>
            <p>Filefox provides an online tool that allows users to upload, convert, and download files in various formats. The service is provided “as is” and may be updated, modified, or discontinued at any time without prior notice.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">User Responsibilities</h2>
            <p>By using Filefox, you agree that:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>You will not upload illegal, harmful, or copyrighted content without permission</li>
              <li>You will not attempt to exploit, hack, or disrupt the service</li>
              <li>You are responsible for the files you upload and their legality</li>
              <li>You will use the service only for lawful purposes</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">File Handling</h2>
            <p>Uploaded files are processed solely for conversion purposes. Files are temporarily stored during processing and are automatically deleted after a limited time. We do not guarantee permanent storage of any file.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">Prohibited Uses</h2>
            <p>You may not use Filefox to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Upload malware, viruses, or malicious code</li>
              <li>Violate intellectual property rights</li>
              <li>Engage in abusive, fraudulent, or illegal activities</li>
              <li>Attempt to reverse engineer or interfere with the platform</li>
              <li>Overload or abuse system resources</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">Intellectual Property</h2>
            <p>All branding, design, logos, and software related to Filefox are the property of Brevia or its licensors. Users retain ownership of their uploaded files but grant Filefox temporary rights to process them for conversion purposes.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">Service Availability</h2>
            <p>We do not guarantee that Filefox will always be available, uninterrupted, or error-free. Maintenance, updates, or technical issues may temporarily affect access to the service.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">Limitation of Liability</h2>
            <p>Filefox and Brevia are not liable for any direct, indirect, or incidental damages resulting from the use or inability to use the service. This includes data loss, service interruptions, or file corruption.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">Changes to Terms</h2>
            <p>We may update these Terms of Service at any time. Continued use of Filefox after changes means you accept the updated terms.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">Termination</h2>
            <p>We reserve the right to suspend or terminate access to Filefox if users violate these terms or misuse the platform.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">Governing Use</h2>
            <p>These terms are governed by applicable laws in the jurisdiction where Brevia operates, unless otherwise required by law.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">Contact Information</h2>
            <p>If you have questions about these Terms of Service, contact us:</p>
            <p className="font-medium">Email: support@filefox.com</p>
          </section>

          <section className="space-y-4">
            <p>Filefox is a product of Brevia. All rights reserved.</p>
          </section>
        </article>
      </main>

      <Footer />
    </div>
  );
}
