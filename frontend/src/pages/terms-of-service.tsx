import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function TermsOfServicePage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-900"
            onClick={() => setLocation("/")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-[#3366FF] border-b border-gray-200 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">Terms of Service</h1>
          <p className="text-white text-lg">Last updated: April 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-10 text-gray-700 leading-relaxed">

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">1. INTRODUCTION AND ACCEPTANCE OF TERMS</h2>
          <p>These Terms of Service ("Terms") constitute a legally binding agreement between the user ("User", "you", or "your") and LoadPilot, a proprietary logistics technology platform owned and operated by Smart Serve Studios Inc. ("LoadPilot", "Platform", "we", "us", or "our").</p>
          <p className="mt-1">By accessing, registering on, or using the Platform in any manner, you acknowledge that you have read, understood, and agreed to be bound by these Terms. Such acceptance is effected through affirmative electronic action and shall be deemed valid and enforceable under applicable law.</p>
          <p className="mt-1">If you do not agree to these Terms, you must refrain from using the Platform.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">2. DEFINITION OF SERVICES</h2>
          <p className="mb-3">LoadPilot provides a digital logistics operating system designed to facilitate coordination between shippers, carriers, fleet operators, and administrators through a unified platform.</p>
          <p className="mb-3">The Platform enables, inter alia:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Onboarding and verification of logistics participants</li>
            <li>Load creation, discovery, and bidding</li>
            <li>Shipment allocation, execution, and tracking</li>
            <li>Financial workflows, including invoicing and settlement</li>
            <li>Compliance management and document verification</li>
            <li>Operational analytics and performance monitoring</li>
          </ul>
          <p className="mt-3">The Platform functions as a coordination and technology layer and does not, unless expressly stated, assume the role of a carrier, transporter, or logistics service provider.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">3. USER ACCOUNTS AND RESPONSIBILITIES</h2>
          <p className="mb-3">To access certain features, Users are required to create an account and provide accurate, complete, and current information.</p>
          <p className="mb-3">The User agrees to:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Maintain the confidentiality of login credentials</li>
            <li>Ensure that all information provided is accurate and not misleading</li>
            <li>Comply with all applicable laws and regulations</li>
            <li>Use the Platform solely for legitimate business purposes</li>
          </ul>
          <p className="mb-3">The User shall not:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Engage in fraudulent, deceptive, or unlawful activities</li>
            <li>Misrepresent identity, capacity, or operational capability</li>
            <li>Interfere with the integrity, security, or performance of the Platform</li>
            <li>Attempt unauthorized access to systems, data, or infrastructure</li>
          </ul>
          <p className="mt-3">The User shall remain solely responsible for all activities conducted through their account.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">4. INTELLECTUAL PROPERTY RIGHTS</h2>
          <p className="mb-3">All rights, title, and interest in and to the Platform, including but not limited to software, systems, workflows, algorithms, interfaces, designs, trademarks, and underlying technology, are and shall remain the exclusive property of LoadPilot.</p>
          <p className="mb-3">No rights are granted to the User other than a limited, non-exclusive, non-transferable right to access and use the Platform in accordance with these Terms.</p>
          <p className="mb-3">The User shall not:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Copy, reproduce, modify, or distribute any part of the Platform</li>
            <li>Reverse engineer or attempt to derive source code</li>
            <li>Create derivative works or competing systems based on the Platform</li>
          </ul>
          <p className="mt-3">Any unauthorized use shall constitute a material breach and may result in immediate termination and legal action.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">5. PAYMENT TERMS</h2>
          <p className="mb-3">Where applicable, use of the Platform may be subject to fees, including subscription charges, usage-based pricing, or enterprise licensing arrangements.</p>
          <p className="mb-3">The User agrees that:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>All fees shall be paid in accordance with agreed commercial terms</li>
            <li>Payments shall be made within the specified timelines</li>
            <li>Failure to make payment may result in suspension or restriction of services</li>
          </ul>
          <p className="mt-3">LoadPilot reserves the right to revise pricing structures, subject to prior notice where required.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">6. TERMINATION</h2>
          <p className="mb-3">LoadPilot reserves the right to suspend or terminate access to the Platform, in whole or in part, at its sole discretion, including but not limited to the following circumstances:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Breach of these Terms</li>
            <li>Non-payment of applicable fees</li>
            <li>Engagement in fraudulent, unlawful, or harmful activities</li>
            <li>Actions that compromise platform integrity or reputation</li>
          </ul>
          <p className="mb-3">Upon termination:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>All rights granted to the User shall immediately cease</li>
            <li>Access to the Platform may be revoked without notice</li>
            <li>Data handling shall be governed by applicable data policies and legal requirements</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">7. LIMITATION OF LIABILITY</h2>
          <p className="mb-3">To the fullest extent permitted by law, LoadPilot shall not be liable for any indirect, incidental, consequential, or special damages, including but not limited to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Loss of profits, revenue, or business opportunity</li>
            <li>Operational delays or disruptions</li>
            <li>Data loss or system interruptions</li>
          </ul>
          <p className="mt-3">The Platform is provided on an "as is" and "as available" basis.</p>
          <p className="mt-3">LoadPilot's total liability, if any, shall be limited to the fees paid by the User to the Platform in the preceding three (3) months.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">8. GOVERNING LAW AND DISPUTE RESOLUTION</h2>
          <p className="mb-3">These Terms shall be governed by and construed in accordance with the laws of India.</p>
          <p className="mb-3">Any disputes arising out of or in connection with these Terms shall be subject to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Exclusive jurisdiction of courts located in New Delhi, India; and/or</li>
            <li>Resolution through arbitration in accordance with the Arbitration and Conciliation Act, 1996</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">9. CHANGES TO TERMS</h2>
          <p>LoadPilot reserves the right to modify or update these Terms at any time.</p>
          <p className="mt-3">Updated Terms shall be made available on the Platform and, where required, notified to Users through appropriate channels.</p>
          <p className="mt-3">Continued use of the Platform following such updates shall constitute acceptance of the revised Terms.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">10. ELECTRONIC ACCEPTANCE</h2>
          <p className="mb-3">By selecting the "I Agree" option during registration or use of the Platform, the User:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Confirms acceptance of these Terms in their entirety</li>
            <li>Acknowledges that such acceptance constitutes a legally binding agreement</li>
            <li>Agrees that electronic consent shall have the same legal effect as a physical signature</li>
          </ul>
        </section>

        {/* Footer CTA */}
      </div>

      <div className="w-full bg-[#1a1a2e] mt-12 py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-400 text-sm text-center sm:text-left">© {new Date().getFullYear()} LoadPilot — Smart Serve Studios Inc. All rights reserved.</p>
          <Button
            className="bg-[#3366FF] hover:bg-[#2255ee] text-white"
            onClick={() => setLocation("/auth?tab=register")}
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
}
