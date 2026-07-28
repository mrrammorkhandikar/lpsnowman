import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, ChevronDown, ChevronUp, Truck, Building2, Package,
  UserCheck, FileText, Shield, Clock, HelpCircle, BookOpen,
  CheckCircle2, AlertCircle, ArrowRight, Users, MapPin, IndianRupee
} from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

interface GuideStep {
  step: number;
  title: string;
  description: string;
}

function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="border border-gray-200 rounded-md overflow-hidden"
          data-testid={`faq-item-${index}`}
        >
          <button
            className="w-full flex items-center justify-between p-4 text-left bg-white hover:bg-gray-50 transition-colors"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            data-testid={`faq-toggle-${index}`}
          >
            <span className="font-medium text-gray-900 pr-4">{item.question}</span>
            {openIndex === index ? (
              <ChevronUp className="h-5 w-5 text-[#1a3a8a] flex-shrink-0" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
            )}
          </button>
          {openIndex === index && (
            <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
              <p className="text-gray-600 leading-relaxed pt-3">{item.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function GuideSection({ title, icon: Icon, steps, ctaLabel, ctaLink }: {
  title: string;
  icon: React.ElementType;
  steps: GuideStep[];
  ctaLabel: string;
  ctaLink: string;
}) {
  const [, setLocation] = useLocation();

  return (
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-md bg-[#1a3a8a] flex items-center justify-center">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => (
          <Card key={step.step} className="border-gray-200" data-testid={`guide-step-${step.step}`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#1a3a8a]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-[#1a3a8a]">{step.step}</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">{step.title}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6">
        <Button
          className="bg-[#1a3a8a] hover:bg-[#162d6e] text-white gap-2"
          onClick={() => setLocation(ctaLink)}
          data-testid={`guide-cta-${title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function FAQsPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"faqs" | "guides">("faqs");
  const [activeCategory, setActiveCategory] = useState("general");

  const faqCategories = [
    { id: "general", label: "General", icon: HelpCircle },
    { id: "registration", label: "Registration", icon: UserCheck },
    { id: "verification", label: "Verification", icon: Shield },
    { id: "shippers", label: "Shippers", icon: Package },
    { id: "carriers", label: "Carriers", icon: Building2 },
    { id: "drivers", label: "Drivers", icon: Truck },
    { id: "pricing", label: "Pricing & Payments", icon: IndianRupee },
  ];

  const faqData: Record<string, FAQItem[]> = {
    general: [
      {
        question: "What is LoadPilot?",
        answer: "LoadPilot is a digital freight marketplace that connects shippers with carriers and independent truck drivers. Our platform streamlines the entire freight lifecycle from load posting to final delivery, with transparent pricing, real-time tracking, and digital document management."
      },
      {
        question: "Who can use LoadPilot?",
        answer: "LoadPilot serves three types of users: Shippers who need to transport goods, Fleet Carriers (companies with multiple trucks), and Solo Drivers (owner-operators with their own truck). Each user type has a dedicated portal tailored to their specific needs."
      },
      {
        question: "How does the admin-as-mediator model work?",
        answer: "Our admin team reviews and prices every load before it reaches carriers. Shippers submit loads without a rate, and our pricing experts set competitive rates based on market conditions, route complexity, and cargo type. This ensures fair pricing for both shippers and carriers."
      },
      {
        question: "Is LoadPilot available across India?",
        answer: "Yes, LoadPilot operates across all major freight corridors in India. Our platform supports routes between all states and union territories, with growing coverage in smaller cities and towns."
      },
      {
        question: "What languages does LoadPilot support?",
        answer: "LoadPilot is available in English, Hindi, Punjabi, Marathi, and Tamil. You can switch between languages at any time from the language selector in the application header."
      },
    ],
    registration: [
      {
        question: "How do I register on LoadPilot?",
        answer: "Visit our registration page and select your role: Shipper, Fleet Carrier, or Solo Driver. Fill in your basic details including name, phone number, email, and password. After registration, you will be guided through the onboarding process specific to your role."
      },
      {
        question: "What information do I need to register?",
        answer: "You need a valid phone number, email address, full name, and company details (for shippers and fleet carriers). Solo drivers need their personal identification details. All users must set a secure password during registration."
      },
      {
        question: "Can I register as both a shipper and a carrier?",
        answer: "Each account is tied to a single role. If you operate as both a shipper and a carrier, you would need separate accounts with different email addresses and phone numbers for each role."
      },
      {
        question: "What happens after I register?",
        answer: "After registration, you will be directed to the onboarding process. This involves submitting your business details, uploading required documents, and waiting for admin verification. You cannot access the full platform features until your account is verified."
      },
      {
        question: "I forgot my password. How do I reset it?",
        answer: "On the login page, click the 'Forgot Password' link. Enter your registered email address, and we will send you instructions to reset your password. Make sure to check your spam folder if you don't receive the email within a few minutes."
      },
    ],
    verification: [
      {
        question: "Why is verification required?",
        answer: "Verification ensures the safety and reliability of our marketplace. It confirms the identity of all participants, validates business credentials, and ensures regulatory compliance. This protects both shippers and carriers from fraudulent activities."
      },
      {
        question: "How long does verification take?",
        answer: "Verification typically takes 1-3 business days after you submit all required documents. Our admin team reviews each application carefully. You will receive a notification once your account status is updated."
      },
      {
        question: "What documents are required for shipper verification?",
        answer: "Shippers need to provide: business registration certificate, GST certificate, company PAN card, authorized signatory identification, and business address proof. Transporters (shippers who also transport) must additionally upload an LR (Lorry Receipt) copy."
      },
      {
        question: "What documents are required for carrier verification?",
        answer: "Fleet carriers need: company registration certificate, fleet insurance documents, GST certificate, and company PAN card. You will also need to register at least one truck with its RC book, insurance, and fitness certificate."
      },
      {
        question: "What documents are required for solo driver verification?",
        answer: "Solo drivers need: a valid driving license, Aadhaar card, PAN card, vehicle Registration Certificate (RC book), vehicle insurance, vehicle fitness certificate, and a recent photograph."
      },
      {
        question: "What happens if my verification is rejected?",
        answer: "If your verification is rejected, you will receive a notification explaining the reason. Common reasons include unclear document images, expired documents, or missing information. You can resubmit corrected documents and the admin team will review your application again."
      },
      {
        question: "Can I use the platform while verification is pending?",
        answer: "You can access your dashboard and complete your profile while verification is pending, but you cannot post loads (shippers) or bid on loads (carriers/drivers) until your account is fully verified and approved."
      },
    ],
    shippers: [
      {
        question: "How do I post a load?",
        answer: "Navigate to 'Post a Load' from your shipper dashboard. Fill in the pickup and delivery locations, cargo details (weight, commodity type, special requirements), and preferred schedule. Submit the load and our admin team will price it before posting it to carriers."
      },
      {
        question: "Can I edit a load after posting it?",
        answer: "Yes, you can edit load details from the load detail page. Editable fields include pickup/delivery locations, cargo information, receiver details, and scheduling. Loads in certain statuses (in transit, delivered, cancelled) cannot be edited."
      },
      {
        question: "How do I track my shipments?",
        answer: "Go to the 'Track Shipments' section in your dashboard. You will see a real-time map showing the current location of your active shipments. Click on any shipment for detailed tracking information including ETA predictions and status updates."
      },
      {
        question: "How is the load pricing determined?",
        answer: "Our admin pricing team evaluates each load based on distance, cargo type, weight, route demand, and current market conditions. Loads can be posted as 'fixed price' (take-it-or-leave-it) or 'negotiable' (carriers can submit counter-bids)."
      },
      {
        question: "How do I receive invoices?",
        answer: "Invoices are generated automatically after a load is delivered. You can view, download, and track all invoices from the 'Invoices' section in your dashboard. The invoice lifecycle goes from created to sent, acknowledged, and finally paid."
      },
      {
        question: "What is the difference between a Shipper and a Transporter role?",
        answer: "During onboarding, you choose whether you are a 'Shipper' (standard freight sender) or a 'Transporter' (someone who both ships and transports goods). Transporters have an additional requirement to upload an LR (Lorry Receipt) copy for verification."
      },
    ],
    carriers: [
      {
        question: "How do I find and bid on loads?",
        answer: "Available loads appear in your marketplace feed. You can filter by route, cargo type, and truck type. For fixed-price loads, click 'Accept' to take the load at the listed rate. For negotiable loads, submit a counter-bid with your preferred rate."
      },
      {
        question: "How do I add trucks to my fleet?",
        answer: "Go to 'Fleet Management' in your carrier dashboard and click 'Add Truck'. Enter the truck details including manufacturer, model, registration number, capacity, and truck type. Upload the required documents (RC book, insurance, fitness certificate)."
      },
      {
        question: "Can I assign specific drivers to loads?",
        answer: "Yes, fleet carriers can assign specific drivers and trucks to loads when submitting a bid. Each truck and driver can only be assigned to one active shipment at a time. Resources become available again after a delivery is completed."
      },
      {
        question: "How does the recommendation system work?",
        answer: "Our intelligent matching system scores loads based on your fleet capabilities. It considers truck type match, weight capacity, route experience, commodity handling experience, and prior relationship with the shipper. Higher-scoring loads appear as 'Recommended For Your Fleet'."
      },
      {
        question: "What happens when my bid is accepted?",
        answer: "When your bid is accepted, you receive an immediate notification. The load moves to 'awarded' status, and a shipment is created with your assigned truck and driver. You can then proceed with pickup using the OTP verification system."
      },
      {
        question: "How do I manage my fleet drivers?",
        answer: "Navigate to 'Drivers' in your carrier dashboard to add, edit, or manage your drivers. Each driver needs a valid license number and contact information. You can track which drivers are currently assigned to active shipments."
      },
    ],
    drivers: [
      {
        question: "What is the Solo Driver Portal?",
        answer: "The Solo Driver Portal is a simplified interface designed specifically for owner-operators. It gives you focused access to load discovery, trip management, earnings tracking, and document management without the complexity of fleet management features."
      },
      {
        question: "How do I start a trip?",
        answer: "When you arrive at the pickup location, go to your active trip and click 'Start Trip'. You will need to enter the OTP provided by the shipper or admin to verify the pickup. This ensures a secure and documented handoff."
      },
      {
        question: "How do I complete a delivery?",
        answer: "Upon reaching the delivery location, click 'Complete Delivery' on your active trip. Enter the delivery OTP to verify completion. Upload proof of delivery documents if required. Your earnings will be calculated and reflected in your dashboard."
      },
      {
        question: "How do I upload my documents?",
        answer: "Go to 'My Documents' in the Solo Driver Portal. Upload your driving license, Aadhaar card, vehicle RC, insurance, fitness certificate, and PAN card. Keep these documents up to date, as expired documents will block you from accepting new loads."
      },
      {
        question: "How do I track my earnings?",
        answer: "The 'My Earnings' section shows a complete breakdown of your completed trips, pending payments, and total revenue. You can filter by date range and see detailed information for each trip including the amount earned."
      },
      {
        question: "What happens if my documents expire?",
        answer: "If any of your required documents expire, your compliance status changes and you will be blocked from bidding on new loads or starting trips. Upload renewed documents and wait for admin re-verification to restore full access."
      },
    ],
    pricing: [
      {
        question: "How is freight pricing calculated?",
        answer: "Our admin team prices each load considering multiple factors: distance, cargo weight and type, route demand and supply, seasonal factors, and current market rates. The goal is fair, transparent pricing that works for both shippers and carriers."
      },
      {
        question: "What are fixed-price vs negotiable loads?",
        answer: "Fixed-price loads have a set rate that carriers can accept or skip. Negotiable loads allow carriers to submit counter-bids with their preferred rate. The admin team can accept, reject, or further negotiate counter-bids."
      },
      {
        question: "Are there any hidden fees?",
        answer: "No. LoadPilot operates on full pricing transparency. The rate you see is the rate you get. There are no hidden platform fees, registration charges, or surprise deductions. Our platform margin is built into the load pricing."
      },
      {
        question: "How do advance payments work?",
        answer: "For certain loads, carriers may receive an advance payment (a percentage of the total freight cost) before the trip begins. The advance amount is clearly shown in the load details and deducted from the final payment upon delivery."
      },
      {
        question: "When do carriers receive payment?",
        answer: "Payment processing begins after the delivery is confirmed and the invoice lifecycle is completed. The shipper receives an invoice, acknowledges it, and makes the payment. Carriers can track payment status in real-time from their revenue dashboard."
      },
    ],
  };

  const shipperGuide: GuideStep[] = [
    { step: 1, title: "Create Your Account", description: "Visit the registration page and select 'Shipper' as your role. Enter your business name, contact details, email, and set a secure password." },
    { step: 2, title: "Complete Onboarding", description: "Fill in your business details: company name, GST number, PAN, and business address. Choose whether you are a Shipper or Transporter." },
    { step: 3, title: "Upload Documents", description: "Upload your business registration certificate, GST certificate, PAN card, and address proof. Transporters must also upload an LR copy." },
    { step: 4, title: "Wait for Verification", description: "Our admin team reviews your documents within 1-3 business days. You will receive a notification once approved." },
    { step: 5, title: "Post Your First Load", description: "Once verified, go to 'Post a Load'. Enter pickup and delivery locations, cargo details, weight, and schedule. Submit for admin pricing." },
    { step: 6, title: "Track and Manage", description: "Monitor your loads through the dashboard. Track active shipments in real-time, manage invoices, and communicate with carriers." },
  ];

  const carrierGuide: GuideStep[] = [
    { step: 1, title: "Create Your Account", description: "Register and select 'Fleet Owner / Company' as your carrier type. Enter your company name, contact details, and fleet size." },
    { step: 2, title: "Complete Onboarding", description: "Submit your company registration details, GST certificate, PAN card, and fleet insurance information during the onboarding process." },
    { step: 3, title: "Upload Company Documents", description: "Provide your company registration certificate, GST certificate, insurance documents, and fleet operator license." },
    { step: 4, title: "Register Your Fleet", description: "After verification, add your trucks via 'Fleet Management'. Enter truck details, capacity, and upload each vehicle's RC, insurance, and fitness certificate." },
    { step: 5, title: "Add Your Drivers", description: "Register your drivers with their license details and contact information. Assign drivers to trucks for load assignments." },
    { step: 6, title: "Browse and Bid", description: "Explore the marketplace for available loads. Use filters to find matching freight. Accept fixed-price loads or submit counter-bids on negotiable ones." },
  ];

  const driverGuide: GuideStep[] = [
    { step: 1, title: "Create Your Account", description: "Register and select 'Solo Driver / Owner Operator' as your carrier type. Enter your name, phone number, and set up your credentials." },
    { step: 2, title: "Complete Onboarding", description: "Enter your personal details, driving license information, and vehicle details including truck type, capacity, and registration number." },
    { step: 3, title: "Upload Your Documents", description: "Upload your driving license, Aadhaar card, PAN card, vehicle RC book, vehicle insurance, fitness certificate, and a photograph." },
    { step: 4, title: "Wait for Verification", description: "The admin team reviews your identity and vehicle documents. Verification typically takes 1-3 business days." },
    { step: 5, title: "Find Loads", description: "Once verified, browse the load feed in your Solo Driver Portal. Loads matching your truck type and capacity are highlighted as recommendations." },
    { step: 6, title: "Accept and Deliver", description: "Accept a load or submit a counter-bid. Use OTP verification at pickup and delivery. Upload proof of delivery and track your earnings." },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <Button variant="ghost" className="text-gray-600 gap-2" onClick={() => setLocation("/")} data-testid="button-back-home">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
          <Button className="bg-[#1a3a8a] hover:bg-[#162d6e] text-white" onClick={() => setLocation("/auth?tab=register")} data-testid="button-get-started-faqs">
            Get Started
          </Button>
        </div>
      </div>

      <section className="relative overflow-hidden bg-[#1a3a8a]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e40af] via-[#1a3a8a] to-[#162d6e]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />
        <div className="max-w-7xl mx-auto px-4 py-16 relative">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" data-testid="text-faqs-title">
              Help Center
            </h1>
            <p className="text-lg text-blue-100 leading-relaxed" data-testid="text-faqs-subtitle">
              Find answers to common questions and step-by-step guides to get started with LoadPilot. Whether you are a shipper, carrier, or driver, we have you covered.
            </p>
          </div>

          <div className="flex gap-3 mt-8">
            <Button
              variant={activeTab === "faqs" ? "default" : "outline"}
              className={activeTab === "faqs"
                ? "bg-white text-[#1a3a8a] hover:bg-gray-100 gap-2"
                : "border-white/30 text-white hover:bg-white/10 gap-2"
              }
              onClick={() => setActiveTab("faqs")}
              data-testid="tab-faqs"
            >
              <HelpCircle className="h-4 w-4" />
              FAQs
            </Button>
            <Button
              variant={activeTab === "guides" ? "default" : "outline"}
              className={activeTab === "guides"
                ? "bg-white text-[#1a3a8a] hover:bg-gray-100 gap-2"
                : "border-white/30 text-white hover:bg-white/10 gap-2"
              }
              onClick={() => setActiveTab("guides")}
              data-testid="tab-guides"
            >
              <BookOpen className="h-4 w-4" />
              User Guides
            </Button>
          </div>
        </div>
      </section>

      {activeTab === "faqs" && (
        <section className="bg-gray-50 py-12">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col lg:flex-row gap-8">
              <aside className="lg:w-64 flex-shrink-0">
                <div className="sticky top-20">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Categories</h3>
                  <nav className="space-y-1">
                    {faqCategories.map((cat) => (
                      <button
                        key={cat.id}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                          activeCategory === cat.id
                            ? "bg-[#1a3a8a] text-white"
                            : "text-gray-700 hover:bg-gray-200"
                        }`}
                        onClick={() => setActiveCategory(cat.id)}
                        data-testid={`faq-category-${cat.id}`}
                      >
                        <cat.icon className="h-4 w-4 flex-shrink-0" />
                        {cat.label}
                      </button>
                    ))}
                  </nav>
                </div>
              </aside>

              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-gray-900 mb-6" data-testid="text-faq-category-title">
                  {faqCategories.find(c => c.id === activeCategory)?.label} Questions
                </h2>
                <FAQAccordion items={faqData[activeCategory] || []} />
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "guides" && (
        <section className="bg-gray-50 py-12">
          <div className="max-w-7xl mx-auto px-4">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-guides-title">Getting Started Guides</h2>
              <p className="text-gray-600">Follow these step-by-step instructions to set up your account and start using LoadPilot.</p>
            </div>

            <GuideSection
              title="Shipper Guide"
              icon={Package}
              steps={shipperGuide}
              ctaLabel="Register as Shipper"
              ctaLink="/auth?tab=register&role=shipper"
            />

            <GuideSection
              title="Fleet Carrier Guide"
              icon={Building2}
              steps={carrierGuide}
              ctaLabel="Register as Fleet Carrier"
              ctaLink="/auth?tab=register&role=carrier&carrierType=fleet"
            />

            <GuideSection
              title="Solo Driver Guide"
              icon={Truck}
              steps={driverGuide}
              ctaLabel="Register as Solo Driver"
              ctaLink="/auth?tab=register&role=carrier&carrierType=solo"
            />
          </div>
        </section>
      )}

      <section className="bg-[#1a3a8a] py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4" data-testid="text-still-questions">
            Still Have Questions?
          </h2>
          <p className="text-blue-100 text-lg mb-8">
            Our support team is here to help. Reach out to us and we will get back to you promptly.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              className="bg-white text-[#1a3a8a] hover:bg-gray-100"
              onClick={() => setLocation("/contact")}
              data-testid="button-contact-support"
            >
              Contact Support
            </Button>
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
              onClick={() => setLocation("/auth?tab=register")}
              data-testid="button-create-account"
            >
              Create an Account
            </Button>
          </div>
        </div>
      </section>

      <footer className="bg-[#0a0a1a] py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            2026 LoadPilot. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}