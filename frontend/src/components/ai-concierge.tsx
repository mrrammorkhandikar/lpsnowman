import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

const quickActions = [
  { label: "Post a new load", action: "post_load" },
  { label: "View nearby trucks", action: "nearby_trucks" },
  { label: "Check my bids", action: "check_bids" },
  { label: "Track shipments", action: "track_shipments" },
  { label: "Fleet status", action: "fleet_status" },
  { label: "Vehicle alerts", action: "vehicle_alerts" },
];

const aiResponses: Record<string, string[]> = {
  greeting: [
    "Hello! I'm your AI assistant. How can I help you today?",
    "Welcome to Load Smart! I'm here to assist you with navigating the platform.",
    "Hi there! Need help with posting loads, finding carriers, or tracking shipments?",
  ],
  post_load: [
    "I can help you post a new load! Here's what you need:\n\n1. Pickup and delivery locations\n2. Cargo weight and type\n3. Preferred pickup date\n\nClick 'Post Load' in the sidebar to get started. I'll guide you through the smart form!",
  ],
  nearby_trucks: [
    "Let me check for available trucks in your area...\n\nI found 12 trucks within 50 miles of your location:\n- 5 Dry Vans (ready now)\n- 4 Flatbeds (available in 2 hours)\n- 3 Refrigerated (scheduled tomorrow)\n\nWould you like me to show you the map view?",
  ],
  check_bids: [
    "Looking at your current bids...\n\nYou have 3 pending bids:\n- Load #1234: 2 bids received, highest: $2,450\n- Load #1235: 5 bids received, highest: $3,100\n- Load #1236: Awaiting bids\n\nTip: Consider responding to bids within 4 hours for better carrier engagement!",
  ],
  track_shipments: [
    "Here's your shipment status summary:\n\n- 2 shipments in transit (on schedule)\n- 1 shipment at pickup point\n- 3 shipments delivered this week\n\nWould you like detailed tracking for any specific shipment?",
  ],
  fleet_status: [
    "Live Fleet Telematics Dashboard:\n\n5 vehicles currently active:\n- 4 vehicles moving (avg 58 km/h)\n- 1 vehicle stopped (low fuel)\n\nVehicle Health:\n- TRK-4096: Engine temp 102C (warning)\n- TRK-5120: Fuel at 8% (critical)\n\nAll other vehicles operating normally. Visit the In-Transit page for real-time GPS tracking and CAN-Bus diagnostics!",
  ],
  vehicle_alerts: [
    "Current Fleet Alerts:\n\n1. TRK-4096: Vehicle overheating (102C)\n   Action: Recommend driver rest stop\n\n2. TRK-5120: Critical fuel level (8%)\n   Action: Nearest fuel station 12km ahead\n\n3. TRK-1024: ETA delay risk HIGH\n   Heavy traffic on Route 1\n\nTip: Enable push notifications to receive real-time alerts on your mobile device!",
  ],
  eta: [
    "ETA Prediction Analysis:\n\nI'm analyzing traffic patterns, weather, and driver behavior...\n\nCurrent Predictions:\n- TRK-1024: Arriving 3:45 PM (15 min delay - heavy traffic)\n- TRK-2048: Arriving 5:20 PM (on schedule)\n- TRK-3072: Arriving tomorrow 8:00 AM (on schedule)\n\nWould you like me to suggest alternate routes for delayed shipments?",
  ],
  driver_behavior: [
    "Driver Behavior Insights:\n\nTop Performers:\n- DRV-221: Score 94/100 (Excellent)\n- DRV-554: Score 87/100 (Good)\n\nNeeds Attention:\n- DRV-889: Score 65/100\n  3 harsh braking events, 5 overspeed incidents\n\nRecommendation: Consider scheduling a safety refresher for DRV-889. Fleet average score: 82/100.",
  ],
  help: [
    "I can help you with:\n\n- Posting and managing loads\n- Finding reliable carriers\n- Tracking your shipments\n- Managing documents\n- Fleet telematics & GPS tracking\n- ETA predictions & route optimization\n- Driver behavior insights\n\nJust ask or select a quick action below!",
  ],
  default: [
    "I understand you're asking about that. Let me help you navigate to the right section.",
    "That's a great question! Based on your query, I'd recommend checking the relevant section in the sidebar.",
    "I'm here to help! Could you provide more details so I can assist you better?",
  ],
};

function getAIResponse(input: string, role?: string): string {
  const lowerInput = input.toLowerCase();
  
  if (lowerInput.includes("hello") || lowerInput.includes("hi") || lowerInput.includes("hey")) {
    return aiResponses.greeting[Math.floor(Math.random() * aiResponses.greeting.length)];
  }
  if (lowerInput.includes("fleet") || lowerInput.includes("telematics") || lowerInput.includes("vehicle health") || lowerInput.includes("gps")) {
    return aiResponses.fleet_status[0];
  }
  if (lowerInput.includes("alert") || lowerInput.includes("warning") || lowerInput.includes("fuel") || lowerInput.includes("temperature") || lowerInput.includes("overheat")) {
    return aiResponses.vehicle_alerts[0];
  }
  if (lowerInput.includes("eta") || lowerInput.includes("arrival") || lowerInput.includes("when will") || lowerInput.includes("delay")) {
    return aiResponses.eta[0];
  }
  if (lowerInput.includes("driver") || lowerInput.includes("behavior") || lowerInput.includes("safety") || lowerInput.includes("score")) {
    return aiResponses.driver_behavior[0];
  }
  if (lowerInput.includes("post") || lowerInput.includes("load") || lowerInput.includes("shipment")) {
    return aiResponses.post_load[0];
  }
  if (lowerInput.includes("truck") || lowerInput.includes("carrier") || lowerInput.includes("nearby")) {
    return aiResponses.nearby_trucks[0];
  }
  if (lowerInput.includes("bid") || lowerInput.includes("offer") || lowerInput.includes("quote")) {
    return aiResponses.check_bids[0];
  }
  if (lowerInput.includes("track") || lowerInput.includes("status") || lowerInput.includes("where")) {
    return aiResponses.track_shipments[0];
  }
  if (lowerInput.includes("help") || lowerInput.includes("what can you do")) {
    return aiResponses.help[0];
  }
  
  return aiResponses.default[Math.floor(Math.random() * aiResponses.default.length)];
}

export function AIConcierge() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const [position, setPosition] = useState({ x: 24, y: 24 });
  const dragState = useRef({ startX: 0, startY: 0, posX: 24, posY: 24, moved: false, dragging: false });

  const onDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
      moved: false,
      dragging: true,
    };
  }, [position]);

  const onDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragState.current;
    if (!d.dragging) return;
    e.preventDefault();
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      d.moved = true;
    }
    if (d.moved) {
      const newX = Math.max(8, Math.min(window.innerWidth - 64, d.posX - dx));
      const newY = Math.max(8, Math.min(window.innerHeight - 64, d.posY - dy));
      setPosition({ x: newX, y: newY });
    }
  }, []);

  const onDragEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragState.current;
    if (!d.dragging) return;
    d.dragging = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
    if (!d.moved) {
      setIsOpen(true);
    }
  }, []);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: Message = {
        id: "welcome",
        content: `Welcome${user?.username ? `, ${user.username}` : ""}! I'm your AI assistant for Load Smart. How can I help you today?`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: getAIResponse(inputValue, user?.role),
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  };

  const handleQuickAction = (action: string) => {
    const responses: Record<string, string> = {
      post_load: aiResponses.post_load[0],
      nearby_trucks: aiResponses.nearby_trucks[0],
      check_bids: aiResponses.check_bids[0],
      track_shipments: aiResponses.track_shipments[0],
      fleet_status: aiResponses.fleet_status[0],
      vehicle_alerts: aiResponses.vehicle_alerts[0],
    };

    const actionLabel = quickActions.find((a) => a.action === action)?.label || action;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      content: actionLabel,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: responses[action] || aiResponses.default[0],
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 800);
  };

  const panelRight = Math.max(0, position.x - 340);
  const panelBottom = Math.max(0, position.y - 544);

  return (
    <>
      {!isOpen && (
        <div
          className="fixed h-14 w-14 rounded-full shadow-lg z-50 bg-primary text-primary-foreground flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          style={{ right: `${position.x}px`, bottom: `${position.y}px` }}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          data-testid="button-ai-concierge"
        >
          <MessageCircle className="h-6 w-6 pointer-events-none" />
        </div>
      )}

      {isOpen && (
        <div 
          className="fixed w-96 h-[600px] bg-card border border-card-border rounded-lg shadow-xl flex flex-col z-50 animate-in slide-in-from-bottom-4 duration-300"
          style={{ right: `${Math.max(8, panelRight)}px`, bottom: `${Math.max(8, panelBottom)}px` }}
          data-testid="ai-concierge-panel"
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">AI Assistant</h3>
                <p className="text-xs text-muted-foreground">Always here to help</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} data-testid="button-close-ai">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
                      message.isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-2 text-sm">
                    <span className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-3 border-t border-border">
            <div className="flex flex-wrap gap-2 mb-3">
              {quickActions.map((action) => (
                <Badge
                  key={action.action}
                  variant="secondary"
                  className="cursor-pointer hover-elevate text-xs"
                  onClick={() => handleQuickAction(action.action)}
                  data-testid={`button-quick-${action.action}`}
                >
                  {action.label}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Ask me anything..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="flex-1"
                data-testid="input-ai-message"
              />
              <Button size="icon" onClick={handleSend} data-testid="button-send-ai">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
