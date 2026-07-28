import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import { ChevronLeft, ChevronRight, ChevronDown, Search, UserCheck, LayoutGrid, Zap, ShieldCheck, MapPin, BarChart3 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoPath from "@assets/Purple_and_Black_Modern_Software_Developer_LinkedIn_Banner_1770118882647.png";

export default function LandingPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);
  
  // Get backend URL for assets - works in both dev and production
  const getAssetUrl = (path: string) => {
    // In production, assets are served from same origin
    if (import.meta.env.PROD) {
      return path;
    }
    // In development, use backend URL directly
    return `http://localhost:5000${path}`;
  };

  // Hero slides data
  const heroSlides = [
    {
      title: "Smarter tools for every carrier",
      subtitle: "Get access to India's largest freight network so you can get the best load first - and fast - plus tools to maximize profits.",
      image: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1200&h=800&fit=crop"
    },
    {
      title: "Connect with trusted shippers",
      subtitle: "Find reliable loads and build lasting partnerships with verified shippers across the country.",
      image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&h=800&fit=crop"
    },
    {
      title: "Maximize your freight profits",
      subtitle: "Use our analytics tools to optimize routes, reduce empty miles, and increase your earnings.",
      image: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=1200&h=800&fit=crop"
    }
  ];

  // Auto-advance hero carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHeroSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const nextHeroSlide = () => {
    setCurrentHeroSlide((prev) => (prev + 1) % heroSlides.length);
  };

  const prevHeroSlide = () => {
    setCurrentHeroSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  };

  const roleCards = [
    {
      role: "Driver",
      shortDescription: "Own your truck, own your future.",
      detailedDescription: "As a Solo Driver, you get exclusive access to our Solo Carrier Portal. Find and accept loads directly, manage your trips in real-time, track your earnings, upload documents, and stay compliant with automated expiry alerts. Your truck, your rules, your profits.",
      image: getAssetUrl("/assets/E5B529F0-62F3-4B17-80D6-64685531E0FA_1770123487619.png")
    },
    {
      role: "Carrier",
      shortDescription: "Grow your fleet business with confidence.",
      detailedDescription: "As a Fleet Carrier, manage your entire fleet from one powerful dashboard. Assign trucks and drivers to loads, track all shipments in real-time, bid on marketplace loads, manage invoices, and maximize fleet utilization. Scale your business with India's largest freight network.",
      image: getAssetUrl("/assets/708CC45D-8B89-4450-992D-90158D6A2F5D_1770123616290.png")
    },
    {
      role: "Shipper",
      shortDescription: "Take charge of your logistics network.",
      detailedDescription: "As a Shipper, post your loads and connect with verified carriers instantly. Get competitive pricing, track shipments in real-time with GPS telematics, manage documents digitally, and gain 360-degree visibility into your transportation network. Streamline your supply chain today.",
      image: getAssetUrl("/assets/PHOTO-2026-01-21-00-10-30_1770123244936.jpg")
    }
  ];

  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [flippedStats, setFlippedStats] = useState<Record<string, boolean>>({});

  const statCards = [
    {
      key: "loads",
      value: "10,000+",
      label: "Loads Delivered",
      detail: "Successfully completed shipments across 28 Indian states with zero cargo loss record."
    },
    {
      key: "carriers",
      value: "500+",
      label: "Trusted Carriers",
      detail: "Verified fleet owners and solo operators with valid permits, insurance, and compliance documents."
    },
    {
      key: "ontime",
      value: "98%",
      label: "On-time Delivery",
      detail: "Industry-leading delivery performance powered by AI route optimization and real-time tracking."
    },
    {
      key: "support",
      value: "24/7",
      label: "Support Available",
      detail: "Round-the-clock assistance via AI Concierge, phone, and email for shippers and carriers."
    }
  ];

  const handleGetStarted = () => {
    setLocation("/auth?tab=register");
  };

  const handleLogin = () => {
    setLocation("/auth");
  };

  const handleSignup = () => {
    setLocation("/auth?tab=register");
  };

  const handleCardSignup = (role: string) => {
    if (role === "Driver") {
      setLocation("/auth?tab=register&role=carrier&carrierType=solo");
    } else if (role === "Carrier") {
      setLocation("/auth?tab=register&role=carrier&carrierType=enterprise");
    } else if (role === "Shipper") {
      setLocation("/auth?tab=register&role=shipper");
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0d1117]">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-[#1a1a2e] border-b border-[#1a1a2e]">
        <div className="flex h-16 items-center justify-between w-full px-4">
          {/* Logo */}
          <div className="flex items-center pl-2">
            <img 
              src={logoPath}
              alt="LoadPilot" 
              className="h-14 w-auto object-contain"
              data-testid="img-logo"
            />
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm text-gray-300" data-testid="nav-solutions">
                Solutions <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1a1a2e] border-gray-700">
                <DropdownMenuItem className="text-white hover:text-white focus:text-white hover:bg-white/10 focus:bg-white/10" data-testid="menu-item-drivers" onClick={() => setLocation("/solutions/drivers")}>For Drivers</DropdownMenuItem>
                <DropdownMenuItem className="text-white hover:text-white focus:text-white hover:bg-white/10 focus:bg-white/10" data-testid="menu-item-carriers" onClick={() => setLocation("/solutions/carriers")}>For Carriers</DropdownMenuItem>
                <DropdownMenuItem className="text-white hover:text-white focus:text-white hover:bg-white/10 focus:bg-white/10" data-testid="menu-item-shippers" onClick={() => setLocation("/solutions/shippers")}>For Shippers</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm text-gray-300" data-testid="nav-resources">
                Resources <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1a1a2e] border-gray-700">
                <DropdownMenuItem className="text-white hover:text-white focus:text-white hover:bg-white/10 focus:bg-white/10" data-testid="menu-item-faqs" onClick={() => setLocation("/faqs")}>FAQs</DropdownMenuItem>
                <DropdownMenuItem className="text-white hover:text-white focus:text-white hover:bg-white/10 focus:bg-white/10" data-testid="menu-item-press-room" onClick={() => setLocation("/press-room")}>Press Room</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              variant="ghost" 
              className="text-sm text-gray-300" 
              data-testid="nav-contact"
              onClick={() => setLocation("/contact")}
            >
              Contact
            </Button>
            <Button 
              variant="ghost" 
              className="text-sm text-gray-300" 
              data-testid="nav-about"
              onClick={() => setLocation("/about")}
            >
              About Us
            </Button>
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-gray-300" data-testid="button-search">
              <Search className="h-5 w-5" />
            </Button>
            <ThemeToggle />
            <Button 
              onClick={handleLogin}
              variant="ghost"
              className="text-sm text-gray-300"
              data-testid="button-login"
            >
              Login
            </Button>
            <Button 
              onClick={handleGetStarted}
              variant="ghost"
              className="text-sm text-white"
              data-testid="button-signup"
            >
              Signup
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section with Video Background + Role Cards Overlay */}
      <section className="relative py-16 md:py-24 overflow-hidden" data-testid="section-hero">
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          data-testid="video-hero-background"
          preload="auto"
        >
          <source src={getAssetUrl("/assets/VN20260316_110532.mp4")} type="video/quicktime" />
          <source src={getAssetUrl("/assets/VN20260316_110532.mp4")} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[#1a1a2e]/60" />

        {/* Stats Cards with Flip */}
        <div className="relative z-10 container mx-auto px-4 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((stat) => (
              <div
                key={stat.key}
                className="relative h-24 cursor-pointer"
                style={{ perspective: '600px' }}
                onClick={() => setFlippedStats(prev => ({ ...prev, [stat.key]: !prev[stat.key] }))}
                data-testid={`stat-${stat.key}`}
              >
                <div
                  className="relative w-full h-full transition-transform duration-500"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: flippedStats[stat.key] ? 'rotateX(180deg)' : 'rotateX(0deg)'
                  }}
                >
                  {/* Front */}
                  <div
                    className="absolute inset-0 bg-white/15 backdrop-blur-sm rounded-lg border border-white/25 p-4 flex flex-col items-center justify-center"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <p className="text-3xl md:text-4xl font-black text-white">{stat.value}</p>
                    <p className="text-white/70 text-sm mt-1">{stat.label}</p>
                  </div>
                  {/* Back */}
                  <div
                    className="absolute inset-0 bg-[#2855CC]/80 backdrop-blur-sm rounded-lg border border-white/25 p-4 flex items-center justify-center"
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}
                  >
                    <p className="text-white text-xs md:text-sm text-center leading-relaxed">{stat.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Role Cards on top of video */}
        <div className="relative z-10 container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            {roleCards.map((card) => (
              <div 
                key={card.role}
                className="relative h-[500px] cursor-pointer"
                style={{ perspective: '1000px' }}
                onClick={() => setFlippedCards(prev => ({ ...prev, [card.role]: !prev[card.role] }))}
                data-testid={`card-role-video-${card.role.toLowerCase()}`}
              >
                <div 
                  className="relative w-full h-full transition-transform duration-700"
                  style={{ 
                    transformStyle: 'preserve-3d',
                    transform: flippedCards[card.role] ? 'rotateY(180deg)' : 'rotateY(0deg)'
                  }}
                >
                  {/* Front of card */}
                  <div 
                    className="absolute inset-0 bg-white/20 dark:bg-[#161b22]/20 backdrop-blur-sm rounded-lg shadow-xl backface-hidden border border-white/30"
                    style={{ backfaceVisibility: 'hidden' }}
                  >
                    <div className="p-8 text-center">
                      <p className="text-white/80 text-xl mb-2">I am a</p>
                      <h3 className="text-4xl font-black text-white mb-6">{card.role}</h3>
                      <Button 
                        className="bg-[#3366FF] text-white rounded-full text-sm font-semibold uppercase tracking-wider"
                        data-testid={`button-get-started-video-${card.role.toLowerCase()}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFlippedCards(prev => ({ ...prev, [card.role]: true }));
                        }}
                      >
                        Get Started
                      </Button>
                    </div>
                    <div className="relative h-48 overflow-hidden">
                      <img 
                        src={card.image} 
                        alt={card.role}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-6">
                      <p className="text-white/70 text-sm text-center leading-relaxed">
                        {card.shortDescription}
                      </p>
                    </div>
                  </div>

                  {/* Back of card */}
                  <div 
                    className="absolute inset-0 bg-[#2855CC] dark:bg-[#1e4499] rounded-lg shadow-xl p-8 flex flex-col justify-between"
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  >
                    <div>
                      <h3 className="text-3xl font-black text-white mb-4">{card.role}</h3>
                      <p className="text-white/90 text-base leading-relaxed mb-6">
                        {card.detailedDescription}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <Button 
                        variant="outline"
                        className="w-full bg-white text-[#2855CC] rounded-full text-sm font-semibold uppercase tracking-wider"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLogin();
                        }}
                        data-testid={`button-login-video-${card.role.toLowerCase()}`}
                      >
                        Login
                      </Button>
                      <Button 
                        className="w-full bg-white text-[#2855CC] rounded-full text-sm font-semibold uppercase tracking-wider"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardSignup(card.role);
                        }}
                        data-testid={`button-signup-video-${card.role.toLowerCase()}`}
                      >
                        Sign Up Now
                      </Button>
                      <Button 
                        variant="ghost"
                        className="w-full text-white/80 hover:text-white hover:bg-white/5 rounded-full text-sm font-semibold uppercase tracking-wider"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFlippedCards(prev => ({ ...prev, [card.role]: false }));
                        }}
                        data-testid={`button-back-video-${card.role.toLowerCase()}`}
                      >
                        Go Back
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Grow Your Business Section */}
      <section className="py-16 bg-white dark:bg-[#0d1117]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold italic text-gray-900 dark:text-white mb-6" data-testid="text-grow-title">
            Grow your business for the long haul
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            We match the right load to the right truck at the right price, with trusted insights. 
            Succeed on India's fastest growing freight network.
          </p>
        </div>
      </section>

      {/* AI Platform Section */}
      <section className="relative py-24">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${getAssetUrl("/assets/7181445E-ECEF-4FE4-9951-343B8B9C7286_1770125833116.png")}')` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#0d1117]/40 via-[#0d1117]/30 to-[#0d1117]/40" />
        </div>
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 drop-shadow-lg" data-testid="text-ai-platform-title">
            India's Reliable AI-Powered Logistics Platform
          </h2>
          <div className="bg-[#0d1117]/70 backdrop-blur-sm rounded-xl p-8 max-w-5xl mx-auto border border-white/10">
            <p className="text-white text-lg md:text-xl leading-relaxed" data-testid="text-ai-platform-description">
              Our intelligent automation transforms freight operations across every portal. <span className="text-[#3366FF] font-semibold">Shippers</span> get AI-powered truck recommendations and smart pricing. <span className="text-[#3366FF] font-semibold">Carriers</span> benefit from algorithmic load matching and route optimization. <span className="text-[#3366FF] font-semibold">Admins</span> leverage real-time analytics and automated compliance tracking. From document verification to predictive ETA calculations, our <span className="text-[#3366FF] font-semibold">AI Concierge</span> works 24/7 to reduce manual work, eliminate errors, and accelerate every transaction.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-[#0d1117]">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-gray-900 dark:text-white mb-4" data-testid="text-features-title">
            Platform Features
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-16 max-w-2xl mx-auto">
            Everything you need to streamline your freight operations
          </p>
          
          {/* First Row */}
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {/* Effortless Onboarding Card */}
            <div className="bg-gray-100 dark:bg-[#161b22] rounded-lg p-8" data-testid="card-feature-onboarding">
              <div className="w-12 h-12 bg-[#3366FF]/10 rounded-lg flex items-center justify-center mb-4">
                <UserCheck className="w-6 h-6 text-[#3366FF]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Effortless Onboarding & Ease of Use</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                No steep learning curve. No technical dependency. Shippers and carriers get productive on Day One with an intuitive, role-based interface.
              </p>
              <p className="text-[#3366FF] text-sm font-semibold">
                Software that works the way logistics already works.
              </p>
            </div>

            {/* Unified Digital Load Marketplace Card */}
            <div className="bg-[#1a1a2e] rounded-lg p-8" data-testid="card-feature-marketplace">
              <div className="w-12 h-12 bg-[#3366FF]/20 rounded-lg flex items-center justify-center mb-4">
                <LayoutGrid className="w-6 h-6 text-[#3366FF]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Unified Digital Load Marketplace</h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                Single pane of glass for shippers, carriers, fleet owners, and brokers. Post loads, bid, assign, and track without fragmentation or phone chaos.
              </p>
              <p className="text-[#3366FF] text-sm font-semibold">
                Speed + liquidity + transparency.
              </p>
            </div>

            {/* Smart Matching & Pricing Engine Card */}
            <div className="bg-gray-100 dark:bg-[#161b22] rounded-lg p-8" data-testid="card-feature-matching">
              <div className="w-12 h-12 bg-[#3366FF]/10 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-[#3366FF]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Smart Matching & Pricing Engine</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                Algorithmic load-to-carrier matching using lane history, truck type, availability, and performance data. Dynamic pricing reduces empty miles and rate disputes.
              </p>
              <p className="text-[#3366FF] text-sm font-semibold">
                Higher margins, faster closes.
              </p>
            </div>
          </div>

          {/* Second Row */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Carrier Trust & Verification Card */}
            <div className="bg-[#1a1a2e] rounded-lg p-8" data-testid="card-feature-verification">
              <div className="w-12 h-12 bg-[#3366FF]/20 rounded-lg flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6 text-[#3366FF]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Carrier Trust & Verification Layer</h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                Built-in KYC, document validation, performance scoring, and compliance tracking. Only verified carriers operate in the ecosystem.
              </p>
              <p className="text-[#3366FF] text-sm font-semibold">
                Risk reduction + enterprise trust.
              </p>
            </div>

            {/* Real-Time Shipment Visibility Card */}
            <div className="bg-gray-100 dark:bg-[#161b22] rounded-lg p-8" data-testid="card-feature-visibility">
              <div className="w-12 h-12 bg-[#3366FF]/10 rounded-lg flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-[#3366FF]" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Real-Time Shipment Visibility</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                Live tracking, milestone updates, and exception alerts across the journey. No black boxes. No "where is the truck?" calls.
              </p>
              <p className="text-[#3366FF] text-sm font-semibold">
                Control, predictability, accountability.
              </p>
            </div>

            {/* Operations & Analytics Command Center Card */}
            <div className="bg-[#1a1a2e] rounded-lg p-8" data-testid="card-feature-analytics">
              <div className="w-12 h-12 bg-[#3366FF]/20 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-[#3366FF]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Operations & Analytics Command Center</h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                Dashboards for on-time delivery, lane performance, carrier efficiency, and cost optimization. Decision-making powered by data, not gut feel.
              </p>
              <p className="text-[#3366FF] text-sm font-semibold">
                Measurable ROI + operational intelligence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section - Black & White Hero */}
      <section className="relative py-32">
        <div 
          className="absolute inset-0 bg-cover"
          style={{ backgroundImage: `url('${getAssetUrl("/assets/94D758F2-0FF2-4869-9B38-FFF2C0762427_1770127007344.png")}')`, backgroundPosition: "35% 25%" }}
        >
          <div className="absolute inset-0 bg-[#1a1a2e]/50" />
        </div>
        <div className="relative z-10 container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white uppercase tracking-wide leading-tight" data-testid="text-about-title">
            We've been taking the<br />
            uncertainty out of<br />
            freight with Smart Serve Studios
          </h2>
        </div>
      </section>

      {/* Company Description Section */}
      <section className="py-16 bg-gray-200 dark:bg-[#21262d]">
        <div className="container mx-auto px-4">
          <h3 className="text-2xl md:text-3xl font-bold text-center text-gray-900 dark:text-white mb-6" data-testid="text-company-brand">
            LoadPilot by Smart Serve Studios
          </h3>
          <p className="text-center text-gray-700 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed" data-testid="text-company-description">
            LoadPilot is an emerging logistics technology platform built by Smart Serve Studios, an Canada-based company dedicated to simplifying freight operations for truck owners, fleet operators, and logistics businesses. Founded with the vision of making logistics smarter and more transparent, Smart Serve Studios brings together industry knowledge and modern technology to solve everyday challenges faced by carriers and shippers. At LoadPilot, we are building a unified platform that helps connect freight, manage dispatch operations, track shipments in real time, and streamline documentation and payments. Our goal is to provide a simple, reliable, and efficient solution that helps transport businesses operate more smoothly and grow faster.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0d1117] pt-16 pb-8">
        <div className="container mx-auto px-4">
          {/* Footer Links */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12 text-center">
            <div>
              <h4 className="text-[#3366FF] font-bold text-sm uppercase tracking-wider mb-4" data-testid="footer-solutions">SOLUTIONS</h4>
              <ul className="space-y-2">
                <li><a href="/solutions/drivers" className="text-gray-400 hover:text-white text-sm transition-colors" data-testid="link-for-drivers">For Drivers</a></li>
                <li><a href="/solutions/carriers" className="text-gray-400 hover:text-white text-sm transition-colors" data-testid="link-for-carriers">For Carriers</a></li>
                <li><a href="/solutions/shippers" className="text-gray-400 hover:text-white text-sm transition-colors" data-testid="link-for-shippers">For Shippers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[#3366FF] font-bold text-sm uppercase tracking-wider mb-4" data-testid="footer-resources">RESOURCES</h4>
              <ul className="space-y-2">
                <li><a href="/faqs" className="text-gray-400 hover:text-white text-sm transition-colors" data-testid="link-faqs">FAQs</a></li>
                <li><a href="/press-room" className="text-gray-400 hover:text-white text-sm transition-colors" data-testid="link-press-room">Press Room</a></li>
                <li><a href="/about" className="text-gray-400 hover:text-white text-sm transition-colors" data-testid="link-about-us">About Us</a></li>
                <li><a href="/terms-of-service" className="text-gray-400 hover:text-white text-sm transition-colors" data-testid="link-terms-of-service">Terms of Service</a></li>
                <li><a href="/privacy-policy" className="text-gray-400 hover:text-white text-sm transition-colors" data-testid="link-privacy-policy">Privacy Policy</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[#3366FF] font-bold text-sm uppercase tracking-wider mb-4" data-testid="footer-contact">CONTACT</h4>
              <ul className="space-y-2">
                <li><a href="/contact" className="text-gray-400 hover:text-white text-sm transition-colors" data-testid="link-contact-us">Contact Us</a></li>
                <li><a href="/auth" className="text-gray-400 hover:text-white text-sm transition-colors" data-testid="link-login">Login / Register</a></li>
              </ul>
            </div>
          </div>

          {/* Carrier App Download */}
          <div className="text-center mb-8">
            <p className="text-gray-500 text-sm mb-4">Download the LoadPilot Carrier App</p>
            <div className="flex justify-center">
              <a
                href="https://play.google.com/store"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-black border border-gray-600 rounded-lg px-4 py-2 flex items-center gap-2 hover:border-gray-400 transition-colors"
                data-testid="badge-google-play"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current text-white">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                </svg>
                <div className="text-left">
                  <p className="text-gray-400 text-[10px]">GET IT ON</p>
                  <p className="text-white text-sm font-semibold">Google Play</p>
                </div>
              </a>
            </div>
          </div>

          {/* Copyright */}
          <div className="text-center">
            <p className="text-gray-600 text-xs" data-testid="text-copyright">
              Copyright 2026 LoadPilot. All rights reserved. All trademarks are the property of their respective owners.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}