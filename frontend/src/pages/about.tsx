import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-context";
import {
  ChevronDown,
  Search,
  Truck,
  Shield,
  Globe,
  Users,
  Target,
  Award,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoPath from "@assets/Purple_and_Black_Modern_Software_Developer_LinkedIn_Banner_1770118882647.png";
import heroCollagePath from "@assets/image_1770401884913.png";
import roadexLogoPath from "@assets/image_1770401901765.png";

export default function AboutPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogin = () => setLocation("/auth");
  const handleSignup = () => setLocation("/auth?tab=register");

  const values = [
    {
      icon: Shield,
      title: "Integrity & Transparency",
      description:
        "No hidden fees, no surprises. Every transaction, every pricing decision is clear and upfront. We believe trust is built on transparency.",
    },
    {
      icon: Truck,
      title: "Built for Truckers",
      description:
        "Our platform is designed by people who understand the road. Every feature serves a real need for carriers, drivers, and shippers.",
    },
    {
      icon: Globe,
      title: "India-Wide Network",
      description:
        "Connecting shippers and carriers across every major route in India, ensuring no truck runs empty and no load waits too long.",
    },
    {
      icon: Target,
      title: "Efficiency First",
      description:
        "AI-powered load matching, real-time tracking, and smart pricing help maximize earnings and minimize wasted time on the road.",
    },
  ];

  const stats = [
    { value: "10,000+", label: "Trucks on Platform" },
    { value: "500+", label: "Cities Covered" },
    { value: "50,000+", label: "Loads Delivered" },
    { value: "99.5%", label: "On-Time Delivery" },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#0d1117]">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-[#1a1a2e] border-b border-[#1a1a2e]">
        <div className="flex h-16 items-center justify-between w-full px-4">
          <div
            className="flex items-center pl-2 cursor-pointer"
            onClick={() => setLocation("/")}
            data-testid="link-logo-home"
          >
            <img
              src={logoPath}
              alt="LoadPilot"
              className="h-14 w-auto object-contain"
              data-testid="img-logo"
            />
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-1 text-sm text-gray-300"
                data-testid="nav-solutions"
              >
                Solutions <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1a1a2e] border-gray-700">
                <DropdownMenuItem
                  className="text-white hover:text-white focus:text-white hover:bg-white/10 focus:bg-white/10"
                  onClick={() => setLocation("/solutions/drivers")}
                >
                  For Drivers
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-white hover:text-white focus:text-white hover:bg-white/10 focus:bg-white/10"
                  onClick={() => setLocation("/solutions/carriers")}
                >
                  For Carriers
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-white hover:text-white focus:text-white hover:bg-white/10 focus:bg-white/10"
                  onClick={() => setLocation("/solutions/shippers")}
                >
                  For Shippers
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-1 text-sm text-gray-300"
                data-testid="nav-resources"
              >
                Resources <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1a1a2e] border-gray-700">
                <DropdownMenuItem
                  className="text-white hover:text-white focus:text-white hover:bg-white/10 focus:bg-white/10"
                  onClick={() => setLocation("/faqs")}
                >
                  FAQs
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-white hover:text-white focus:text-white hover:bg-white/10 focus:bg-white/10"
                  onClick={() => setLocation("/press-room")}
                >
                  Press Room
                </DropdownMenuItem>
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
              className="text-sm text-white font-semibold"
              data-testid="nav-about"
              onClick={() => setLocation("/about")}
            >
              About Us
            </Button>
          </nav>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-300"
              data-testid="button-search"
            >
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
              onClick={handleSignup}
              variant="ghost"
              className="text-sm text-white"
              data-testid="button-signup"
            >
              Signup
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section - Royal Blue with Collage */}
      <section
        className="relative overflow-hidden"
        style={{ backgroundColor: "#1a3a8f" }}
        data-testid="section-about-hero"
      >
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 40%)",
            }}
          />
        </div>
        <div className="relative z-10 container mx-auto px-4 py-16 md:py-24">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            {/* Left - Text Content */}
            <div className="text-left">
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight"
                data-testid="text-about-title"
              >
                About LoadPilot
              </h1>
              <p
                className="text-lg md:text-xl text-blue-100 mb-6 leading-relaxed"
                data-testid="text-about-subtitle"
              >
                India's digital freight marketplace, built to simplify logistics
                for every shipper, carrier, and driver on the road.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <span className="text-blue-200 text-sm">Powered by</span>
                <a
                  href="https://www.smartservestudios.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-smartservestudios"
                >
                  {/* <img
                    src={roadexLogoPath}
                    alt="RoadEx"
                    className="h-10 md:h-12 w-auto object-contain"
                    style={{ mixBlendMode: "screen" }}
                    data-testid="img-roadex-logo"
                  /> */}
                  Smart Serve Studios
                </a>
              </div>
            </div>
            {/* Right - Collage Image */}
            <div className="flex justify-center md:justify-end">
              <img
                src={heroCollagePath}
                alt="LoadPilot - Trucking collage"
                className="w-full max-w-md md:max-w-lg object-contain"
                data-testid="img-hero-collage"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section
        className="border-b border-blue-100 dark:border-gray-800"
        style={{ backgroundColor: "#f0f4ff" }}
        data-testid="section-stats"
      >
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
                <div
                  className="text-3xl md:text-4xl font-bold mb-1"
                  style={{ color: "#1a3a8f" }}
                >
                  {stat.value}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-16 md:py-20" data-testid="section-our-story">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2
              className="text-3xl md:text-4xl font-bold mb-8 text-center"
              style={{ color: "#1a3a8f" }}
              data-testid="text-our-story-title"
            >
              Our Story
            </h2>
            <div className="space-y-6 text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
              <p>
                LoadPilot was born from a simple observation: India's freight
                industry, the backbone of its economy, was still running on
                phone calls, paper trails, and guesswork. Shippers struggled to
                find reliable carriers, carriers ran empty miles searching for
                loads, and pricing was opaque at best.
              </p>
              <p>
                Today, LoadPilot connects thousands of shippers and carriers
                across India through an intelligent marketplace that uses
                AI-driven load matching, real-time GPS tracking, transparent
                pricing, and automated compliance. Whether you're a solo
                owner-operator or a large fleet, our platform is designed to help
                you earn more, waste less, and grow with confidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Powered by Smart Serve Studios Section */}
      <section
        className="py-16 md:py-20"
        style={{ backgroundColor: "#1a3a8f" }}
        data-testid="section-smartservestudios"
      >
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2
              className="text-3xl md:text-4xl font-bold text-white mb-6"
              data-testid="text-smartservestudios-title"
            >
              Powered by Smart Serve Studios
            </h2>
            <p className="text-blue-100 text-lg leading-relaxed mb-8">
              What began as a small creative concept evolved into a next-generation business ecosystem redefining how companies scale. Smart Serve Studios was founded on one belief  growth shouldn’t be fragmented. We built a unified engine combining automation, AI, digital marketing, and in-person expansion to empower brands globally.
From startup founders to enterprise leaders, our mission is simple: connect intelligence, creativity, and execution under one roof. Every project, every system, every client win moves us closer to a world where innovation and efficiency work as one.
            </p>
            <div className="grid md:grid-cols-3 gap-6 mb-10">
              <div className="bg-white/10 rounded-md p-6 text-left">
                <h3 className="text-white font-semibold text-lg mb-2">
                  Industry Expertise
                </h3>
                <p className="text-blue-200 text-sm leading-relaxed">
                  Decades of hands-on trucking experience from fleet ownership to
                  driver management, bringing real-world knowledge to every
                  platform feature.
                </p>
              </div>
              <div className="bg-white/10 rounded-md p-6 text-left">
                <h3 className="text-white font-semibold text-lg mb-2">
                  Trucker-First Approach
                </h3>
                <p className="text-blue-200 text-sm leading-relaxed">
                  Every feature is designed with the trucker in mind - from
                  simplified onboarding to transparent pricing and instant
                  payment tools.
                </p>
              </div>
              <div className="bg-white/10 rounded-md p-6 text-left">
                <h3 className="text-white font-semibold text-lg mb-2">
                  Global Vision
                </h3>
                <p className="text-blue-200 text-sm leading-relaxed">
                  Combining Smart Serve Studios proven US model with deep understanding of
                  India's logistics landscape to create a world-class freight
                  marketplace.
                </p>
              </div>
            </div>
            <a
              href="https://www.smartservestudios.com/about"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="button-visit-smartservestudios"
            >
              <Button
                size="lg"
                className="bg-white text-[#1a3a8f] font-semibold rounded-md"
              >
                Visit Smart Serve Studios
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section
        className="py-16 md:py-20 bg-white dark:bg-[#0d1117]"
        data-testid="section-values"
      >
        <div className="container mx-auto px-4">
          <h2
            className="text-3xl md:text-4xl font-bold mb-12 text-center"
            style={{ color: "#1a3a8f" }}
            data-testid="text-values-title"
          >
            What We Stand For
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {values.map((value) => (
              <Card
                key={value.title}
                className="p-6 border border-blue-100 dark:border-gray-700"
                data-testid={`card-value-${value.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div
                  className="w-12 h-12 rounded-md flex items-center justify-center mb-4"
                  style={{ backgroundColor: "#e8eeff" }}
                >
                  <value.icon className="h-6 w-6" style={{ color: "#1a3a8f" }} />
                </div>
                <h3
                  className="font-semibold text-lg mb-2"
                  style={{ color: "#1a3a8f" }}
                >
                  {value.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {value.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section
        className="py-16 md:py-20"
        style={{ backgroundColor: "#f0f4ff" }}
        data-testid="section-mission"
      >
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-10 max-w-5xl mx-auto">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: "#1a3a8f" }}
                >
                  <Target className="h-5 w-5 text-white" />
                </div>
                <h3
                  className="text-2xl font-bold"
                  style={{ color: "#1a3a8f" }}
                  data-testid="text-mission-title"
                >
                  Our Mission
                </h3>
              </div>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
                To digitally transform India's freight industry by connecting
                shippers and carriers on a transparent, efficient, and
                technology-driven platform. We aim to eliminate empty miles,
                reduce logistics costs, and ensure every trucker earns what they
                deserve.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: "#1a3a8f" }}
                >
                  <Award className="h-5 w-5 text-white" />
                </div>
                <h3
                  className="text-2xl font-bold"
                  style={{ color: "#1a3a8f" }}
                  data-testid="text-vision-title"
                >
                  Our Vision
                </h3>
              </div>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
                To become India's most trusted freight marketplace where every
                load finds the right carrier, every carrier maximizes their
                earnings, and the entire supply chain operates with complete
                visibility and accountability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        className="py-16 md:py-20"
        style={{ backgroundColor: "#1a3a8f" }}
        data-testid="section-cta"
      >
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-blue-100 text-lg max-w-2xl mx-auto mb-8">
            Join thousands of shippers and carriers who are already using
            LoadPilot to move freight smarter, faster, and more profitably.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-white text-[#1a3a8f] font-semibold rounded-md"
              onClick={handleSignup}
              data-testid="button-cta-signup"
            >
              Create Your Account
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/50 text-white bg-white/10 font-semibold rounded-md"
              onClick={() => setLocation("/contact")}
              data-testid="button-cta-contact"
            >
              Contact Us
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1a1a2e] py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img
                src={logoPath}
                alt="LoadPilot"
                className="h-10 w-auto object-contain"
              />
            </div>
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <span>Powered by</span>
              <a
                href="https://www.smartservestudios.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white font-semibold underline underline-offset-2"
                data-testid="link-footer-smartservestudios"
              >
                Smart Serve Studios
              </a>
            </div>
            <div className="text-gray-500 text-sm">
              Copyrights 2026 LoadPilot. All Rights Reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

