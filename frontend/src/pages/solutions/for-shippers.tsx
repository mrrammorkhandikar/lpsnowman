import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft, Package, MapPin, IndianRupee, Shield, Clock,
  FileText, Eye, CheckCircle2, BarChart3, Bell, Zap
} from "lucide-react";
import dashboardImg from "@assets/Screenshot_2026-02-06_at_5.09.04_PM_1770377946011.png";
import trackingImg from "@assets/Screenshot_2026-02-06_at_5.16.19_PM_1770378380816.png";

export default function ForShippersPage() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: Zap,
      title: "Post Loads in Minutes",
      description: "Create a load posting with just a few details: pickup, delivery, cargo, and schedule. Our platform handles the rest, from connecting you with verified carriers to managing the bidding process on your behalf."
    },
    {
      icon: Shield,
      title: "Verified Carrier Network",
      description: "Every carrier on LoadPilot is verified through a rigorous onboarding process. Documents, insurance, and fleet details are checked before they can bid on your freight, giving you peace of mind with every shipment."
    },
    {
      icon: IndianRupee,
      title: "Admin-Mediated Pricing",
      description: "Our logistics experts review and price your loads based on current market rates, route complexity, and cargo type. You get competitive pricing without the guesswork, and carriers get fair rates that keep them coming back."
    },
    {
      icon: Eye,
      title: "Real-Time Shipment Visibility",
      description: "Track every shipment from pickup to delivery with live GPS updates, AI-powered ETA predictions, and instant status notifications. Know exactly where your goods are at every moment, without making a single phone call."
    },
    {
      icon: FileText,
      title: "Automated Documentation",
      description: "Receive delivery proofs, invoices, and compliance documents digitally. Every document is time-stamped, securely stored, and accessible from your dashboard. No more chasing carriers for paperwork."
    },
    {
      icon: BarChart3,
      title: "Shipment Analytics",
      description: "Gain insights into your shipping patterns, carrier performance, and cost trends. Identify your most efficient routes, compare carrier reliability, and optimise your logistics spend with data you can act on."
    },
  ];

  const stats = [
    { value: "Verified", label: "Carrier Network" },
    { value: "Live", label: "GPS Tracking" },
    { value: "Expert", label: "Pricing Support" },
    { value: "Digital", label: "Document Trail" },
  ];

  const checklistItems = [
    "Real-time GPS tracking with AI-powered ETA predictions",
    "Instant notifications when shipment status changes",
    "OTP-verified pickup and delivery for secure handoffs",
    "Digital proof of delivery uploaded by the carrier",
    "Automated invoicing and payment tracking",
    "Vehicle telematics for driver behaviour and route insights",
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <Button variant="ghost" className="text-gray-600 gap-2" onClick={() => setLocation("/")} data-testid="button-back-home">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
          <Button onClick={() => setLocation("/auth?tab=register&role=shipper")} data-testid="button-get-started-shippers">
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
                <Package className="h-4 w-4" />
                Built for Shippers
              </div>
              <h1 data-testid="text-hero-title" className="text-4xl lg:text-5xl font-bold mb-6 leading-tight text-white">
                Ship with confidence.
                <span className="text-blue-200"> Track with clarity.</span>
              </h1>
              <p className="text-lg text-blue-100 mb-8 leading-relaxed">
                LoadPilot connects you with a verified network of carriers, handles 
                competitive pricing through expert mediators, and gives you full visibility 
                into every shipment. Post your load and let the best carrier come to you.
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <Button size="lg" className="bg-white text-[#1a3a8a] border-white/80" onClick={() => setLocation("/auth?tab=register&role=shipper")} data-testid="button-signup-shipper">
                  Start Shipping
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-md overflow-hidden border border-white/20 shadow-2xl">
                <img src={dashboardImg} alt="LoadPilot shipper dashboard" className="w-full" />
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
            <h2 data-testid="text-features-title" className="text-3xl font-bold mb-4 text-gray-900">Move your freight with total peace of mind</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              From posting a load to receiving delivery confirmation, 
              every step is transparent, secure, and backed by real-time data.
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
              <img src={trackingImg} alt="LoadPilot shipment tracking" className="w-full" />
            </div>
            <div>
              <h2 data-testid="text-visibility-title" className="text-3xl font-bold mb-6 text-gray-900">Complete visibility, from pickup to delivery</h2>
              <div className="space-y-4">
                {checklistItems.map((item, index) => (
                  <div key={item} className="flex items-start gap-3" data-testid={`checklist-item-${index}`}>
                    <CheckCircle2 className="h-5 w-5 text-[#1a3a8a] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">{item}</span>
                  </div>
                ))}
              </div>
              <Button className="mt-8 bg-[#1a3a8a] border-[#1a3a8a]" size="lg" onClick={() => setLocation("/auth?tab=register&role=shipper")} data-testid="button-join-shipper">
                Post Your First Load
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#1a3a8a]">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 data-testid="text-cta-title" className="text-3xl font-bold mb-4 text-white">Ready to simplify your shipping?</h2>
          <p className="text-blue-200 mb-8">
            Create your account, complete a quick business verification, 
            and start posting loads to India's most trusted carrier network.
          </p>
          <Button size="lg" className="bg-white text-[#1a3a8a] border-white/80" onClick={() => setLocation("/auth?tab=register&role=shipper")} data-testid="button-cta-shipper">
            Create Your Shipper Account
          </Button>
        </div>
      </section>
    </div>
  );
}
