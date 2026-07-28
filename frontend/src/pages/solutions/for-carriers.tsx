import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft, Truck, Users, IndianRupee, Shield, BarChart3,
  FileText, Target, CheckCircle2, Layers, Settings, Award
} from "lucide-react";
import fleetImg from "@assets/Screenshot_2026-02-06_at_5.02.46_PM_1770377568893.png";
import marketplaceImg from "@assets/Screenshot_2026-02-06_at_5.04.53_PM_1770377694702.png";

export default function ForCarriersPage() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: Layers,
      title: "Fleet Management at Scale",
      description: "Manage your entire fleet from a single dashboard. Track every truck, assign drivers, monitor availability, and ensure no vehicle sits idle when there is freight to move."
    },
    {
      icon: Target,
      title: "Smart Load Recommendations",
      description: "Our intelligent matching engine scores every available load against your fleet's capabilities. Get personalized recommendations based on truck type, capacity, route history, and commodity experience."
    },
    {
      icon: IndianRupee,
      title: "Competitive Bidding Marketplace",
      description: "Bid on loads that match your fleet's strengths. Accept fixed-price loads instantly or submit counter-offers on negotiable freight. Every bid is tracked, and you are notified the moment a decision is made."
    },
    {
      icon: Users,
      title: "Driver Assignment and Tracking",
      description: "Assign drivers to specific loads with a single click. Track their trip progress in real time, manage compliance documents, and keep your operations running smoothly across multiple routes."
    },
    {
      icon: BarChart3,
      title: "Revenue Analytics",
      description: "Understand your business performance with detailed revenue breakdowns by route, truck, and time period. Identify your most profitable lanes and make data-driven decisions to grow your fleet's earnings."
    },
    {
      icon: Shield,
      title: "Document Compliance Engine",
      description: "Stay ahead of regulatory requirements with automated document tracking. Upload insurance, permits, and fitness certificates. Get advance warnings before any document expires so you never lose a bid."
    },
  ];

  const stats = [
    { value: "30+", label: "Truck Types Supported" },
    { value: "Smart", label: "Load Matching" },
    { value: "Real-Time", label: "Fleet Tracking" },
    { value: "Instant", label: "Bid Notifications" },
  ];

  const checklistItems = [
    "Browse all available loads in a real-time marketplace",
    "Get match scores showing how well each load fits your fleet",
    "Submit bids or accept fixed-price loads instantly",
    "Counter-offer on negotiable loads to get the best rate",
    "Automatic resource checks prevent double-booking trucks",
    "Assign truck and driver at bid time for faster dispatch",
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <Button variant="ghost" className="text-gray-600 gap-2" onClick={() => setLocation("/")} data-testid="button-back-home">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
          <Button onClick={() => setLocation("/auth?tab=register&role=carrier&carrierType=enterprise")} data-testid="button-get-started-carriers">
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
                Built for Fleet Operators
              </div>
              <h1 data-testid="text-hero-title" className="text-4xl lg:text-5xl font-bold mb-6 leading-tight text-white">
                Scale your fleet.
                <span className="text-blue-200"> Multiply your profits.</span>
              </h1>
              <p className="text-lg text-blue-100 mb-8 leading-relaxed">
                LoadPilot gives fleet carriers the tools to manage multiple trucks, 
                assign the right driver to the right load, and win more freight through 
                intelligent matching. Stop chasing loads and let the best ones come to you.
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <Button size="lg" className="bg-white text-[#1a3a8a] border-white/80" onClick={() => setLocation("/auth?tab=register&role=carrier&carrierType=enterprise")} data-testid="button-signup-carrier">
                  Register Your Fleet
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-md overflow-hidden border border-white/20 shadow-2xl">
                <img src={fleetImg} alt="LoadPilot fleet management dashboard" className="w-full" />
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
            <h2 data-testid="text-features-title" className="text-3xl font-bold mb-4 text-gray-900">Run your fleet like a modern logistics company</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              From a single truck to a hundred, LoadPilot scales with you. 
              Every tool is designed to reduce empty miles, improve utilisation, and grow revenue.
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
            <div>
              <h2 data-testid="text-bidding-title" className="text-3xl font-bold mb-6 text-gray-900">Win more loads with smarter bidding</h2>
              <div className="space-y-4">
                {checklistItems.map((item, index) => (
                  <div key={item} className="flex items-start gap-3" data-testid={`checklist-item-${index}`}>
                    <CheckCircle2 className="h-5 w-5 text-[#1a3a8a] flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600">{item}</span>
                  </div>
                ))}
              </div>
              <Button className="mt-8 bg-[#1a3a8a] border-[#1a3a8a]" size="lg" onClick={() => setLocation("/auth?tab=register&role=carrier&carrierType=enterprise")} data-testid="button-join-carrier">
                Start Bidding on Loads
              </Button>
            </div>
            <div className="rounded-md overflow-hidden border border-gray-200 shadow-lg">
              <img src={marketplaceImg} alt="LoadPilot carrier marketplace" className="w-full" />
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#1a3a8a]">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 data-testid="text-cta-title" className="text-3xl font-bold mb-4 text-white">Ready to put your fleet to work?</h2>
          <p className="text-blue-200 mb-8">
            Register your fleet, add your trucks and drivers, and start receiving 
            load recommendations matched to your capabilities. It takes minutes to get started.
          </p>
          <Button size="lg" className="bg-white text-[#1a3a8a] border-white/80" onClick={() => setLocation("/auth?tab=register&role=carrier&carrierType=enterprise")} data-testid="button-cta-carrier">
            Create Your Fleet Account
          </Button>
        </div>
      </section>
    </div>
  );
}
