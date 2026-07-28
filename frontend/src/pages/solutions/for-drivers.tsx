import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft, Truck, MapPin, IndianRupee, Shield, Clock, 
  FileText, Navigation, Smartphone, CheckCircle2, Star, Route
} from "lucide-react";
import loadFeedImg from "@assets/Screenshot_2026-02-06_at_4.22.53_PM_1770375176508.png";
import trackingImg from "@assets/Screenshot_2026-02-06_at_4.48.12_PM_1770376694148.png";
import docsImg from "@assets/Screenshot_2026-02-06_at_4.48.57_PM_1770376738784.png";

export default function ForDriversPage() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: Route,
      title: "Instant Load Discovery",
      description: "Browse available loads tailored to your truck type and preferred routes. Our smart matching algorithm surfaces the most relevant freight opportunities so you spend less time searching and more time earning."
    },
    {
      icon: IndianRupee,
      title: "Transparent, Fair Pricing",
      description: "Every load comes with clear pricing upfront. No hidden fees, no last-minute deductions. You see exactly what you will earn before you commit, giving you full control over your income."
    },
    {
      icon: Navigation,
      title: "Real-Time Trip Tracking",
      description: "Stay connected throughout every trip with built-in GPS tracking. Update your status with a single tap, and keep shippers informed automatically without phone calls or manual check-ins."
    },
    {
      icon: Shield,
      title: "OTP-Secured Pickups and Deliveries",
      description: "Every trip start and completion is verified through a secure OTP gate. This protects you from disputes and ensures every handoff is documented and tamper-proof."
    },
    {
      icon: FileText,
      title: "Digital Document Management",
      description: "Upload and manage your vehicle documents, licenses, and delivery proofs all in one place. Get alerts before documents expire so your compliance status stays green and you never miss a load."
    },
    {
      icon: IndianRupee,
      title: "Earnings Dashboard",
      description: "Track every rupee you earn with a detailed breakdown of completed trips, pending payments, and total revenue. See your financial performance at a glance and plan your next moves with confidence."
    },
  ];

  const stats = [
    { value: "500+", label: "Active Loads Daily" },
    { value: "24/7", label: "Load Availability" },
    { value: "100%", label: "Digital Payments" },
    { value: "Zero", label: "Hidden Charges" },
  ];

  const checklistItems = [
    "One-tap status updates from pickup to delivery",
    "Secure OTP verification at every checkpoint",
    "Automatic trip history with full details",
    "Instant earnings visibility after each delivery",
    "Document upload for POD and compliance",
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <Button variant="ghost" className="text-gray-600 gap-2" onClick={() => setLocation("/")} data-testid="button-back-home">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
          <Button onClick={() => setLocation("/auth?tab=register&role=carrier&carrierType=solo")} data-testid="button-get-started-drivers">
            Get Started
          </Button>
        </div>
      </div>

      <section className="relative overflow-hidden bg-[#1a3a8a]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e40af] via-[#1a3a8a] to-[#162d6e]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />
        <div className="max-w-7xl mx-auto px-4 py-20 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-blue-100 text-sm mb-6">
                <Truck className="h-4 w-4" />
                Built for Independent Drivers
              </div>
              <h1 data-testid="text-hero-title" className="text-4xl lg:text-5xl font-bold mb-6 leading-tight text-white">
                Your truck, your rules.
                <span className="text-blue-200"> We just make it easier.</span>
              </h1>
              <p className="text-lg text-blue-100 mb-8 leading-relaxed">
                LoadPilot puts owner-operators in the driver's seat. Find the best-paying loads near you, 
                manage your trips with one tap, and get paid faster. No middlemen, no confusion, 
                just freight that fits your schedule and your truck.
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <Button size="lg" className="bg-white text-[#1a3a8a] border-white/80" onClick={() => setLocation("/auth?tab=register&role=carrier&carrierType=solo")} data-testid="button-signup-driver">
                  Start Earning Today
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-md overflow-hidden border border-white/20 shadow-2xl">
                <img src={loadFeedImg} alt="LoadPilot driver dashboard" className="w-full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#1e40af]" data-testid="section-stats">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={stat.label} data-testid={`stat-item-${index}`}>
                <div className="text-3xl font-bold text-white mb-1" data-testid={`stat-value-${index}`}>{stat.value}</div>
                <div className="text-sm text-blue-200" data-testid={`stat-label-${index}`}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 data-testid="text-features-title" className="text-3xl font-bold mb-4 text-gray-900">Everything a driver needs, nothing they don't</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              We built every feature around what independent drivers actually need on the road. 
              Simple tools that save time and put more money in your pocket.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={feature.title} className="bg-white border-gray-200 hover-elevate" data-testid={`card-feature-${index}`}>
                <CardContent className="p-6">
                  <div className="h-10 w-10 rounded-md bg-[#1a3a8a]/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-5 w-5 text-[#1a3a8a]" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="rounded-md overflow-hidden border border-gray-200 shadow-lg">
              <img src={trackingImg} alt="LoadPilot trip intelligence and active trips" className="w-full" />
            </div>
            <div>
              <h2 data-testid="text-tracking-title" className="text-3xl font-bold mb-6 text-gray-900">Track your trips. Watch your earnings grow.</h2>
              <div className="space-y-4">
                {checklistItems.map((item, index) => (
                  <div key={item} className="flex items-start gap-3" data-testid={`checklist-item-${index}`}>
                    <CheckCircle2 className="h-5 w-5 text-[#1a3a8a] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center mt-20">
            <div className="order-2 lg:order-1">
              <h2 data-testid="text-docs-title" className="text-3xl font-bold mb-6 text-gray-900">Share documents in real-time. Stay compliant effortlessly.</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#1a3a8a] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Upload LR, e-way bills, POD, and invoices instantly</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#1a3a8a] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Shippers see documents the moment you share them</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#1a3a8a] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Automatic document status tracking and timestamps</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#1a3a8a] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">Quick actions to mark deliveries complete</span>
                </div>
              </div>
              <Button className="mt-8 bg-[#1a3a8a] border-[#1a3a8a]" size="lg" onClick={() => setLocation("/auth?tab=register&role=carrier&carrierType=solo")} data-testid="button-join-driver">
                Join as a Driver
              </Button>
            </div>
            <div className="order-1 lg:order-2 rounded-md overflow-hidden border border-gray-200 shadow-lg">
              <img src={docsImg} alt="LoadPilot real-time document sharing" className="w-full" />
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#1a3a8a]">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 data-testid="text-cta-title" className="text-3xl font-bold mb-4 text-white">Ready to hit the road with better loads?</h2>
          <p className="text-blue-200 mb-8">
            Sign up in minutes, add your truck details, and start browsing available freight. 
            No paperwork headaches, no waiting around.
          </p>
          <Button size="lg" className="bg-white text-[#1a3a8a] border-white/80" onClick={() => setLocation("/auth?tab=register&role=carrier&carrierType=solo")} data-testid="button-cta-driver">
            Create Your Free Account
          </Button>
        </div>
      </section>
    </div>
  );
}
