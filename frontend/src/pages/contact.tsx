import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Mail, Phone, MapPin, Send, ArrowLeft, Clock } from "lucide-react";

/** Indian mobile: 10 digits starting 6–9, or 12 digits with leading 91. Ignores spaces and punctuation. */
function isIndianMobileFormatOk(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  const core =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(-10)
      : digits.length === 10
        ? digits
        : "";
  return core.length === 10 && /^[6-9]\d{9}$/.test(core);
}

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address (e.g. name@example.com)"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .refine(isIndianMobileFormatOk, {
      message:
        "Enter a valid Indian mobile: 10 digits starting with 6–9, or +91 and 10 digits (spaces allowed).",
    }),
  subject: z.string().min(3, "Subject must be at least 3 characters"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

export default function ContactPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: data.name,
          email: data.email,
          phone: data.phone || null,
          subject: data.subject || null,
          message: data.message,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit");
      }

      toast({
        title: "Message Sent",
        description: result.message || "Thank you for contacting us. We'll get back to you soon!",
      });
      form.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a8a] via-[#1e40af] to-[#2563eb]">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className="text-white hover:bg-white/20"
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Home
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <img
              src="/assets/Purple_and_Black_Modern_Software_Developer_LinkedIn_Banner_1770118882647.png"
              alt="LoadPilot"
              className="h-16 w-auto object-contain"
            />
          </div>
          <div className="flex items-center gap-2 text-white [&_button]:text-white [&_svg]:text-white">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Contact Us
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            Have questions about our freight services? We're here to help. Reach out to us and we'll respond as soon as possible.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Contact Information */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white">
              <CardContent className="p-6 space-y-6">
                <h2 className="text-2xl font-bold">Get in Touch</h2>
                <p className="text-white/80">
                  Our team is ready to assist you with all your logistics needs.
                </p>

                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20">
                      <Mail className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Email</h3>
                      <a
                        href="mailto:info@smartservestudios.com"
                        className="text-white/80 hover:text-white transition-colors"
                        data-testid="link-email"
                      >
                        info@smartservestudios.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20">
                      <Phone className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Customer Support</h3>
                      <a
                        href="tel:+919876543210"
                        className="text-white/80 hover:text-white transition-colors"
                        data-testid="link-phone"
                      >
                        +91 70872 04510
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20">
                      <MapPin className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Office Address</h3>
                      <p className="text-white/80">
                        2 Wellington St W<br />
                        Brampton<br />
                        ON L6Y 4R2<br />
                        Canada
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20">
                      <Clock className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Business Hours</h3>
                      <p className="text-white/80">
                        Mon - Sat: 9:00 AM - 6:00 PM
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card className="bg-white border-0 shadow-2xl">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-[#1e3a8a] mb-6">
                  Send us a Message
                </h2>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700">Full Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Your name"
                                className="border-gray-300 focus:border-[#2563eb] focus:ring-[#2563eb]"
                                data-testid="input-name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700">Email Address</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="your@email.com"
                                autoComplete="email"
                                className="border-gray-300 focus:border-[#2563eb] focus:ring-[#2563eb]"
                                data-testid="input-email"
                                {...field}
                                onBlur={() => {
                                  field.onBlur();
                                  void form.trigger("email");
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700">Phone Number</FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                inputMode="tel"
                                placeholder="+91 98765 43210"
                                autoComplete="tel"
                                className="border-gray-300 focus:border-[#2563eb] focus:ring-[#2563eb]"
                                data-testid="input-phone"
                                {...field}
                                onBlur={() => {
                                  field.onBlur();
                                  void form.trigger("phone");
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="subject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-700">Subject</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="How can we help?"
                                className="border-gray-300 focus:border-[#2563eb] focus:ring-[#2563eb]"
                                data-testid="input-subject"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700">Message</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Tell us more about your inquiry..."
                              className="min-h-[150px] border-gray-300 focus:border-[#2563eb] focus:ring-[#2563eb] resize-none"
                              data-testid="input-message"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full bg-[#1e3a8a] hover:bg-[#1e40af] text-white py-6 text-lg font-semibold"
                      disabled={isSubmitting}
                      data-testid="button-submit"
                    >
                      {isSubmitting ? (
                        "Sending..."
                      ) : (
                        <>
                          <Send className="h-5 w-5 mr-2" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
