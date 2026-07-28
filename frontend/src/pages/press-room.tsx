import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Newspaper, Send,
  Globe, TrendingUp, Users, Truck, CheckCircle2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import newsFreepImg from "@assets/image_1770402429539.png";
import newsTruckerImg from "@assets/image_1770402550795.png";
import newsMliveImg from "@assets/image_1770402663970.png";

export default function PressRoomPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organization: "",
    inquiryType: "",
    message: "",
  });

  const stats = [
    { icon: Truck, value: "3", label: "User Roles Supported" },
    { icon: Users, value: "5", label: "Languages Available" },
    { icon: Globe, value: "Pan-India", label: "Route Coverage" },
    { icon: TrendingUp, value: "12-Step", label: "Load Lifecycle" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.organization || !formData.inquiryType || !formData.message) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields before submitting.",
        variant: "destructive",
      });
      return;
    }
    setFormSubmitted(true);
    toast({
      title: "Inquiry Submitted",
      description: "Thank you for your interest. Our press team will get back to you within 24 hours.",
    });
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <Button variant="ghost" className="text-gray-600 gap-2" onClick={() => setLocation("/")} data-testid="button-back-home">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
          <Button className="bg-[#1a3a8a] hover:bg-[#162d6e] text-white" onClick={() => setLocation("/auth?tab=register")} data-testid="button-get-started-press">
            Get Started
          </Button>
        </div>
      </div>

      <section className="relative overflow-hidden bg-[#1a3a8a]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e40af] via-[#1a3a8a] to-[#162d6e]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />
        <div className="max-w-7xl mx-auto px-4 py-16 relative">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <Newspaper className="h-8 w-8 text-blue-200" />
              <span className="text-blue-200 text-sm font-medium uppercase tracking-wider">Press Room</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" data-testid="text-press-title">
              News & Press Releases
            </h1>
            <p className="text-lg text-blue-100 leading-relaxed" data-testid="text-press-subtitle">
              Stay updated with the latest news, product launches, and milestones from LoadPilot. For press inquiries, use the contact form below.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#1e40af] py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <div key={i} className="text-center" data-testid={`press-stat-${i}`}>
                <stat.icon className="h-6 w-6 text-blue-200 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-blue-200">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-inquiry-title">Press Inquiry Form</h2>
            <p className="text-gray-600">For media inquiries, interview requests, or press kit access, please fill out the form below.</p>
          </div>

          {formSubmitted ? (
            <Card className="border-gray-200" data-testid="press-form-success">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Inquiry Submitted</h3>
                <p className="text-gray-600 mb-6">
                  Thank you for reaching out. Our press team will review your inquiry and respond within 24 hours.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFormSubmitted(false);
                    setFormData({ name: "", email: "", organization: "", inquiryType: "", message: "" });
                  }}
                  data-testid="button-submit-another"
                >
                  Submit Another Inquiry
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-gray-200" data-testid="press-form-card">
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="press-name">Full Name</Label>
                      <Input
                        id="press-name"
                        placeholder="Your full name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        data-testid="input-press-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="press-email">Email Address</Label>
                      <Input
                        id="press-email"
                        type="email"
                        placeholder="you@publication.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        data-testid="input-press-email"
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="press-org">Organization / Publication</Label>
                      <Input
                        id="press-org"
                        placeholder="Your organization"
                        value={formData.organization}
                        onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                        data-testid="input-press-org"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="press-type">Inquiry Type</Label>
                      <Select
                        value={formData.inquiryType}
                        onValueChange={(value) => setFormData({ ...formData, inquiryType: value })}
                      >
                        <SelectTrigger data-testid="select-press-type">
                          <SelectValue placeholder="Select inquiry type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="media-coverage">Media Coverage</SelectItem>
                          <SelectItem value="interview">Interview Request</SelectItem>
                          <SelectItem value="press-kit">Press Kit Access</SelectItem>
                          <SelectItem value="partnership">Partnership Inquiry</SelectItem>
                          <SelectItem value="data-request">Data / Statistics Request</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="press-message">Message</Label>
                    <Textarea
                      id="press-message"
                      placeholder="Tell us about your inquiry, including any deadlines or specific topics you are interested in..."
                      className="min-h-[120px]"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      data-testid="input-press-message"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="bg-[#1a3a8a] hover:bg-[#162d6e] text-white gap-2 w-full md:w-auto"
                    data-testid="button-submit-press"
                  >
                    <Send className="h-4 w-4" />
                    Submit Inquiry
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section className="bg-[#1a3a8a] py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-3" data-testid="text-press-cta">
            Want to Learn More About LoadPilot?
          </h2>
          <p className="text-blue-100 mb-6">
            Explore our platform features or create an account to experience the future of freight logistics.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              className="bg-white text-[#1a3a8a] hover:bg-gray-100"
              onClick={() => setLocation("/faqs")}
              data-testid="button-view-faqs"
            >
              View FAQs
            </Button>
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
              onClick={() => setLocation("/auth?tab=register")}
              data-testid="button-create-account-press"
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