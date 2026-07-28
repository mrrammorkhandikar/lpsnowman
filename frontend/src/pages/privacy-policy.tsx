import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
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
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">Privacy Policy</h1>
          <p className="text-white text-lg">Effective Date: 14 March, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6 text-gray-700 leading-relaxed">

        <p>This Privacy Policy ("Policy") sets forth the manner in which LoadPilot, a proprietary logistics technology platform owned and operated by Smart Serve Studios Inc. (hereinafter referred to as "LoadPilot", "Platform", "we", "us", or "our"), collects, uses, processes, stores, and discloses personal data in connection with access to and use of its services. This Policy is intended to ensure compliance with applicable data protection laws, including the Digital Personal Data Protection Act, 2023 (India), and to provide a clear and transparent account of the Platform's data handling practices.</p>
        <p>In the course of providing its services, LoadPilot collects personal data that is necessary, proportionate, and directly related to the operation of a digitally coordinated logistics ecosystem. Such data may include, without limitation, identity-related information, including government-issued identifiers, contact details, business and operational information, financial and banking details required for transaction processing, vehicle and fleet-related data, shipment-related information, and regulatory or compliance documentation. In addition to data provided directly by Users, the Platform may collect certain technical and usage-related data automatically, including device information, IP address, access logs, and location data where such information is necessary for the execution, monitoring, or optimization of logistics operations.</p>
        <p>Personal data may be collected through various means integral to the functioning of the Platform, including user registration processes, onboarding and verification workflows, document submissions, transactional interactions, system-generated logs, and the use of cookies or similar tracking technologies. All such collection is undertaken strictly in furtherance of legitimate operational, regulatory, and security requirements.</p>
        <p>The personal data so collected shall be processed solely for lawful, specific, and clearly defined purposes, including, but not limited to, identity verification and onboarding, facilitation of logistics transactions such as load creation, bidding, allocation, and execution, real-time shipment tracking and coordination, processing of payments and financial settlements, compliance with applicable legal and regulatory obligations, prevention of fraud and mitigation of operational risk, facilitation of necessary communications, and the generation of internal analytics for system optimization and performance improvement. Under no circumstances shall personal data be processed for purposes incompatible with those described herein without obtaining further consent where required by law.</p>
        <p>LoadPilot may, where necessary for the provision of its services, disclose personal data to verified participants within its logistics ecosystem, including shippers, carriers, and fleet operators, as well as to financial institutions, infrastructure providers, and service partners engaged in supporting platform operations. Such disclosures shall be limited to what is reasonably required for the relevant purpose and shall be subject to appropriate safeguards. Personal data may also be disclosed where required by applicable law, regulatory authority, or judicial process. For the avoidance of doubt, any aggregated, anonymized, or system-generated data, including analytics, operational insights, and platform intelligence derived from the use of the Platform, shall remain the sole and exclusive property of LoadPilot and shall not constitute personal data of any individual User.</p>
        <p>LoadPilot implements appropriate technical and organizational measures designed to protect personal data against unauthorized access, disclosure, alteration, or destruction. Such measures include, inter alia, secure data storage infrastructure, encryption protocols, access control mechanisms, and continuous monitoring systems. While commercially reasonable efforts are undertaken to safeguard data, the User acknowledges that no system can be entirely immune from risk and that absolute security cannot be guaranteed.</p>
        <p>Personal data shall be retained only for such duration as is necessary to fulfill the purposes for which it was collected, including compliance with applicable legal, regulatory, and accounting obligations. LoadPilot reserves the right to retain certain categories of data for longer periods where required for dispute resolution, enforcement of legal rights, fraud prevention, audit requirements, or other legitimate business purposes.</p>
        <p>Subject to applicable law, Users retain certain rights in respect of their personal data, including the right to request access, correction, or erasure of such data, as well as the right to withdraw consent for its processing. Any such request may be submitted through the designated communication channels provided by the Platform. It is, however, acknowledged that the withdrawal of consent or request for erasure may affect the ability of LoadPilot to provide its services and may result in suspension or termination of access to the Platform where such processing is essential to service delivery.</p>
        <p>The Platform is not intended for use by individuals under the age of eighteen (18), and LoadPilot does not knowingly collect personal data from minors. In the event that such data is identified, appropriate steps shall be taken to delete it in accordance with applicable legal requirements.</p>
        <p>The Platform may, from time to time, contain links to third-party websites or services. LoadPilot does not control and is not responsible for the privacy practices of such third parties, and Users are encouraged to review the applicable policies of those entities independently.</p>
        <p>LoadPilot reserves the right to modify or update this Policy from time to time in order to reflect changes in legal, regulatory, or operational requirements. Any such updates shall be made available through the Platform or communicated through appropriate channels, and continued use of the Platform following such updates shall constitute acceptance of the revised Policy.</p>
        <p>For any queries, concerns, or requests relating to this Policy or the processing of personal data, Users may contact the designated Grievance Officer at{" "}
          <a href="mailto:info@smartservestudios.com" className="text-blue-600 underline">info@smartservestudios.com</a>
          , and all such communications shall be addressed in accordance with applicable legal requirements.
        </p>

      </div>

      {/* Footer */}
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
