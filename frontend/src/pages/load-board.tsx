import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  TrendingUp, 
  Clock, 
  Shield, 
  Zap,
  MapPin,
  Truck,
  DollarSign,
  Bell,
  BarChart3
} from "lucide-react";

import logoPath from "@assets/Purple_and_Black_Modern_Software_Developer_LinkedIn_Banner_1770118882647.png";
import loadBoardScreenshot from "@assets/Screenshot_2026-02-04_at_6.10.24_PM_1770208825423.png";
import shipperPostLoadScreenshot from "@assets/Screenshot_2026-02-04_at_6.21.15_PM_1770209478249.png";

export default function LoadBoard() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full bg-gradient-to-r from-[#1e3a8a] via-[#1e40af] to-[#2563eb] border-b border-white/20">
        <div className="flex h-16 items-center justify-between w-full px-4">
          <div className="flex items-center gap-4 pl-2">
            <Link href="/">
              <img 
                src={logoPath}
                alt="LoadPilot" 
                className="h-14 w-auto object-contain cursor-pointer"
                data-testid="img-logo"
              />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" className="text-white hover:bg-white/20" data-testid="button-back-home">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <Link href="/auth">
              <Button className="bg-white text-[#1e3a8a] hover:bg-white/90 font-semibold" data-testid="button-get-started">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden bg-gradient-to-br from-[#1e3a8a] via-[#1e40af] to-[#2563eb]">
        <div className="relative z-10 container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6" data-testid="text-hero-title">
              LoadPilot <span className="text-white/90">Load Board</span>
            </h1>
            <p className="text-xl text-white/80 mb-8 leading-relaxed" data-testid="text-hero-description">
              India's most trusted digital freight marketplace connecting shippers with verified carriers. 
              Find the right loads, set competitive rates, and grow your business with real-time matching.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/auth">
                <Button size="lg" className="bg-white text-[#1e3a8a] hover:bg-white/90 px-8 font-semibold" data-testid="button-post-load">
                  Post a Load
                </Button>
              </Link>
              <Link href="/auth">
                <Button size="lg" className="bg-white text-[#1e3a8a] hover:bg-white/90 px-8 font-semibold" data-testid="button-find-loads">
                  Find Loads
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Preview Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a8a] text-center mb-4" data-testid="text-preview-title">
              See Our Platform in Action
            </h2>
            <p className="text-gray-600 text-center mb-10 max-w-2xl mx-auto">
              Experience smart load matching with AI-powered recommendations tailored to your fleet
            </p>
            <div className="bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] rounded-2xl p-4 shadow-2xl">
              <img 
                src={loadBoardScreenshot}
                alt="LoadPilot Load Board Interface"
                className="w-full rounded-lg shadow-lg"
                data-testid="img-load-board-preview"
              />
            </div>
          </div>
        </div>
      </section>

      {/* What is Load Board Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a8a] text-center mb-8" data-testid="text-what-is-title">
              What is the LoadPilot Load Board?
            </h2>
            <div className="bg-gradient-to-br from-[#1e3a8a] via-[#1e40af] to-[#2563eb] rounded-xl p-8 shadow-xl">
              <p className="text-white text-lg leading-relaxed mb-6">
                The LoadPilot Load Board is a comprehensive digital freight marketplace designed specifically for the Indian logistics industry. 
                It serves as a centralized platform where shippers can post their freight requirements and carriers can discover, bid on, and accept loads that match their capacity and routes.
              </p>
              <p className="text-white text-lg leading-relaxed mb-6">
                Unlike traditional methods of finding freight through phone calls and personal networks, our Load Board provides instant access to thousands of verified loads across India. 
                With advanced filtering, real-time notifications, and transparent pricing, you can make informed decisions and maximize your earnings.
              </p>
              <p className="text-white text-lg leading-relaxed">
                Whether you're an owner-operator looking for your next haul or a fleet carrier managing multiple trucks, 
                the LoadPilot Load Board streamlines your operations and connects you with reliable business partners.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a8a] text-center mb-4" data-testid="text-features-title">
            Key Features
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Powerful tools designed to help you find the right loads and grow your business
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <Card className="bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] border-0 p-6 shadow-lg hover:shadow-xl transition-shadow" data-testid="card-feature-search">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Advanced Search</h3>
              <p className="text-white/80">
                Search loads by origin, destination, weight, truck type, and more. Find exactly what you need with powerful filtering options.
              </p>
            </Card>

            {/* Feature 2 */}
            <Card className="bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] border-0 p-6 shadow-lg hover:shadow-xl transition-shadow" data-testid="card-feature-realtime">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Real-Time Updates</h3>
              <p className="text-white/80">
                Get instant notifications when new loads matching your preferences are posted. Never miss an opportunity again.
              </p>
            </Card>

            {/* Feature 3 */}
            <Card className="bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] border-0 p-6 shadow-lg hover:shadow-xl transition-shadow" data-testid="card-feature-verified">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Verified Partners</h3>
              <p className="text-white/80">
                All shippers and carriers on our platform undergo rigorous verification. Trade with confidence and security.
              </p>
            </Card>

            {/* Feature 4 */}
            <Card className="bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] border-0 p-6 shadow-lg hover:shadow-xl transition-shadow" data-testid="card-feature-bidding">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Competitive Bidding</h3>
              <p className="text-white/80">
                Transparent bidding system allows you to set your rates. Accept fixed-price loads or negotiate for the best deal.
              </p>
            </Card>

            {/* Feature 5 */}
            <Card className="bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] border-0 p-6 shadow-lg hover:shadow-xl transition-shadow" data-testid="card-feature-tracking">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Route Optimization</h3>
              <p className="text-white/80">
                Intelligent route matching helps you find loads along your preferred routes. Reduce empty miles and maximize profits.
              </p>
            </Card>

            {/* Feature 6 */}
            <Card className="bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] border-0 p-6 shadow-lg hover:shadow-xl transition-shadow" data-testid="card-feature-analytics">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Market Insights</h3>
              <p className="text-white/80">
                Access real-time market data and rate trends. Make informed decisions with comprehensive analytics.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a8a] text-center mb-4" data-testid="text-how-it-works-title">
            How It Works
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Get started in minutes and find your next load today
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto mb-12">
            {/* For Shippers */}
            <div className="bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] rounded-xl p-8 shadow-xl">
              <h3 className="text-2xl font-bold text-white mb-6">For Shippers</h3>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 text-[#1e3a8a] font-bold">1</div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Post Your Load</h4>
                    <p className="text-white/70 text-sm">Enter pickup/delivery locations, cargo details, and schedule</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 text-[#1e3a8a] font-bold">2</div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Receive Bids</h4>
                    <p className="text-white/70 text-sm">Verified carriers submit competitive bids for your load</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 text-[#1e3a8a] font-bold">3</div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Select & Track</h4>
                    <p className="text-white/70 text-sm">Choose the best carrier and track your shipment in real-time</p>
                  </div>
                </div>
              </div>
            </div>

            {/* For Carriers */}
            <div className="bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] rounded-xl p-8 shadow-xl">
              <h3 className="text-2xl font-bold text-white mb-6">For Carriers</h3>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 text-[#1e3a8a] font-bold">1</div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Browse Loads</h4>
                    <p className="text-white/70 text-sm">Search and filter loads by route, weight, and truck type</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 text-[#1e3a8a] font-bold">2</div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Place Your Bid</h4>
                    <p className="text-white/70 text-sm">Submit competitive rates or accept fixed-price loads instantly</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 text-[#1e3a8a] font-bold">3</div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Get Paid Fast</h4>
                    <p className="text-white/70 text-sm">Complete the delivery and receive quick, secure payments</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Shipper Interface Preview */}
          <div className="max-w-5xl mx-auto">
            <h3 className="text-2xl font-bold text-[#1e3a8a] text-center mb-6">Shipper Portal - Post Load Interface</h3>
            <div className="bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] rounded-2xl p-4 shadow-2xl">
              <img 
                src={shipperPostLoadScreenshot}
                alt="Shipper Post Load Interface"
                className="w-full rounded-lg shadow-lg"
                data-testid="img-shipper-post-load"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-[#1e3a8a] text-center mb-12" data-testid="text-benefits-title">
            Why Choose LoadPilot Load Board?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <div className="text-center p-6 bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] rounded-xl shadow-lg">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-2">10,000+</h3>
              <p className="text-white/80">Active Loads Daily</p>
            </div>
            
            <div className="text-center p-6 bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] rounded-xl shadow-lg">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-2">5,000+</h3>
              <p className="text-white/80">Verified Carriers</p>
            </div>
            
            <div className="text-center p-6 bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] rounded-xl shadow-lg">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-2">500+</h3>
              <p className="text-white/80">Cities Covered</p>
            </div>
            
            <div className="text-center p-6 bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] rounded-xl shadow-lg">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-2">30%</h3>
              <p className="text-white/80">Avg. Savings</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-[#1e3a8a] via-[#1e40af] to-[#2563eb]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6" data-testid="text-cta-title">
            Ready to Find Your Next Load?
          </h2>
          <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of shippers and carriers who trust LoadPilot for their freight needs. 
            Sign up today and start maximizing your profits.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/auth">
              <Button size="lg" className="bg-white text-[#1e3a8a] hover:bg-white/90 px-8 font-semibold" data-testid="button-cta-signup">
                Create Free Account
              </Button>
            </Link>
            <Link href="/">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8" data-testid="button-cta-learn">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1e3a8a] py-8 border-t border-white/20">
        <div className="container mx-auto px-4 text-center">
          <p className="text-white/70 text-sm">
            Copyright 2026 LoadPilot. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
