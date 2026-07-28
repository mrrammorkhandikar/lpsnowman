import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X, Send, Phone, Mail, Loader2, Minus, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isError?: boolean;
}

export function HelpBotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [btnPos, setBtnPos] = useState({ right: 24, bottom: 24 });
  const dragInfo = useRef({ startX: 0, startY: 0, origRight: 24, origBottom: 24, moved: false, active: false });

  const onBtnPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      origRight: btnPos.right,
      origBottom: btnPos.bottom,
      moved: false,
      active: true,
    };
  }, [btnPos]);

  const onBtnPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragInfo.current;
    if (!d.active) return;
    e.preventDefault();
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      d.moved = true;
    }
    if (d.moved) {
      const newRight = Math.max(8, Math.min(window.innerWidth - 72, d.origRight - dx));
      const newBottom = Math.max(8, Math.min(window.innerHeight - 72, d.origBottom - dy));
      setBtnPos({ right: newRight, bottom: newBottom });
    }
  }, []);

  const onBtnPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragInfo.current;
    if (!d.active) return;
    d.active = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
    if (!d.moved) {
      setIsOpen(true);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamError(false);

    const assistantId = `assistant-${Date.now()}`;
    let assistantContent = "";

    try {
      const response = await fetch("/api/helpbot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.conversationId && !conversationId) {
                setConversationId(data.conversationId);
              }
              
              if (data.error) {
                setStreamError(true);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId 
                      ? { ...m, content: data.error, isError: true } 
                      : m
                  )
                );
                break;
              }
              
              if (data.content) {
                assistantContent += data.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: assistantContent } : m
                  )
                );
              }
              
              if (data.done) {
                break;
              }
            } catch (e) {
              // Skip non-JSON lines
            }
          }
        }
      }

      // Handle case where stream ends with empty content
      if (!assistantContent && !streamError) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Sorry, I couldn't generate a response. Please try again.", isError: true }
              : m
          )
        );
      }
    } catch (error) {
      console.error("Chat error:", error);
      // If we already added an assistant message placeholder, update it with error
      setMessages((prev) => {
        const hasPlaceholder = prev.some(m => m.id === assistantId);
        if (hasPlaceholder) {
          return prev.map(m =>
            m.id === assistantId
              ? { ...m, content: "Sorry, I encountered an error. Please try again or contact our support team.", isError: true }
              : m
          );
        }
        return [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant" as const,
            content: "Sorry, I encountered an error. Please try again or contact our support team.",
            timestamp: new Date(),
            isError: true,
          },
        ];
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, conversationId, streamError]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setShowContactInfo(false);
    setStreamError(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    startNewConversation();
  };

  const handleMinimize = () => {
    setIsOpen(false);
  };

  const widgetContent = (
    <div id="helpbot-portal-root">
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 191, 255, 0.4), 0 0 40px rgba(0, 191, 255, 0.2); }
          50% { box-shadow: 0 0 30px rgba(0, 191, 255, 0.6), 0 0 60px rgba(0, 191, 255, 0.3); }
        }
        .chat-bubble-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .futuristic-border {
          background: linear-gradient(135deg, rgba(0, 191, 255, 0.3), rgba(22, 37, 79, 0.8));
        }
        .glass-effect {
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
      `}</style>
      
      {!isOpen ? (
        <button
          className="fixed h-16 w-16 rounded-full z-[9999] flex items-center justify-center chat-bubble-glow cursor-grab active:cursor-grabbing touch-none select-none"
          style={{ 
            right: `${btnPos.right}px`,
            bottom: `${btnPos.bottom}px`,
            background: 'linear-gradient(135deg, #00BFFF, #0080FF)',
            boxShadow: '0 0 20px rgba(0, 191, 255, 0.4), 0 0 40px rgba(0, 191, 255, 0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
          }}
          onPointerDown={onBtnPointerDown}
          onPointerMove={onBtnPointerMove}
          onPointerUp={onBtnPointerUp}
          onPointerCancel={onBtnPointerUp}
          data-testid="button-helpbot-open"
        >
          <MessageCircle className="h-7 w-7 text-white pointer-events-none" />
        </button>
      ) : (
        <div 
          className="fixed w-[380px] h-[550px] rounded-2xl flex flex-col z-[9999] overflow-hidden glass-effect"
          style={{
            right: `${Math.max(8, btnPos.right - 314)}px`,
            bottom: `${Math.max(8, btnPos.bottom - 484)}px`,
            background: 'linear-gradient(180deg, #060817 0%, #0d1525 50%, #060817 100%)',
            border: '1px solid rgba(0, 191, 255, 0.3)',
            boxShadow: '0 0 40px rgba(0, 191, 255, 0.15), 0 25px 50px -12px rgba(0, 0, 0, 0.8)'
          }}
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between p-4 border-b"
            style={{ 
              background: 'linear-gradient(90deg, rgba(0, 191, 255, 0.15), rgba(22, 37, 79, 0.4))',
              borderColor: 'rgba(0, 191, 255, 0.2)'
            }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="h-10 w-10 rounded-xl flex items-center justify-center"
                style={{ 
                  background: 'linear-gradient(135deg, #00BFFF, #0080FF)',
                  boxShadow: '0 0 15px rgba(0, 191, 255, 0.5)'
                }}
              >
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-semibold text-white text-lg">Priya</span>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-[#667D9D]">Online</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#667D9D] hover:text-white hover:bg-white/10 rounded-lg"
                onClick={handleMinimize}
                title="Minimize chat"
                data-testid="button-helpbot-minimize"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[#667D9D] hover:text-white hover:bg-white/10 rounded-lg"
                onClick={handleClose}
                title="Close and end chat"
                data-testid="button-helpbot-close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="text-center space-y-6 pt-8">
                <div 
                  className="h-20 w-20 mx-auto rounded-2xl flex items-center justify-center"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(0, 191, 255, 0.2), rgba(22, 37, 79, 0.4))',
                    border: '1px solid rgba(0, 191, 255, 0.3)',
                    boxShadow: '0 0 30px rgba(0, 191, 255, 0.2)'
                  }}
                >
                  <MessageCircle className="h-10 w-10" style={{ color: '#00BFFF' }} />
                </div>
                <div>
                  <h3 className="font-semibold text-xl text-white mb-2">How can I help you?</h3>
                  <p className="text-sm text-[#667D9D] max-w-xs mx-auto">
                    Ask me anything about Load Smart, or connect with our support team.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center pt-2">
                  {[
                    { label: "Post a load", query: "How do I post a load?" },
                    { label: "Track shipment", query: "How do I track my shipment?" },
                    { label: "Required docs", query: "What documents do I need?" }
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => setInput(item.query)}
                      className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105"
                      style={{
                        background: 'rgba(0, 191, 255, 0.1)',
                        border: '1px solid rgba(0, 191, 255, 0.3)',
                        color: '#00BFFF'
                      }}
                      data-testid={`button-helpbot-quick-${item.label.toLowerCase().replace(' ', '-')}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3",
                        message.role === "user"
                          ? ""
                          : message.isError
                            ? ""
                            : ""
                      )}
                      style={
                        message.role === "user"
                          ? {
                              background: 'linear-gradient(135deg, #00BFFF, #0080FF)',
                              boxShadow: '0 4px 15px rgba(0, 191, 255, 0.3)'
                            }
                          : message.isError
                            ? {
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#fca5a5'
                              }
                            : {
                                background: 'rgba(22, 37, 79, 0.6)',
                                border: '1px solid rgba(0, 191, 255, 0.15)'
                              }
                      }
                    >
                      <p className={cn(
                        "text-sm whitespace-pre-wrap",
                        message.role === "user" ? "text-white" : message.isError ? "" : "text-[#ACBBC6]"
                      )}>
                        {message.content || (isLoading && message.role === "assistant" ? "Thinking..." : "")}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex justify-start">
                    <div 
                      className="rounded-2xl px-4 py-3"
                      style={{
                        background: 'rgba(22, 37, 79, 0.6)',
                        border: '1px solid rgba(0, 191, 255, 0.15)'
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#00BFFF' }} />
                        <span className="text-sm text-[#667D9D]">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Contact Info */}
          {showContactInfo && (
            <div 
              className="px-4 py-3 border-t"
              style={{ 
                background: 'rgba(22, 37, 79, 0.4)',
                borderColor: 'rgba(0, 191, 255, 0.15)'
              }}
            >
              <p className="text-sm font-medium mb-2 text-white">Contact Support</p>
              <div className="space-y-2 text-sm text-[#667D9D]">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" style={{ color: '#00BFFF' }} />
                  <span>+91 1800-XXX-XXXX</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" style={{ color: '#00BFFF' }} />
                  <span>support@loadsmart.in</span>
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div 
            className="p-4 border-t"
            style={{ borderColor: 'rgba(0, 191, 255, 0.15)' }}
          >
            <div className="flex gap-2 mb-3">
              <button
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: 'rgba(0, 191, 255, 0.1)',
                  color: '#00BFFF'
                }}
                onClick={() => setShowContactInfo(!showContactInfo)}
                data-testid="button-helpbot-contact"
              >
                <Phone className="h-3 w-3" />
                Contact
              </button>
              {messages.length > 0 && (
                <button
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: 'rgba(102, 125, 157, 0.2)',
                    color: '#667D9D'
                  }}
                  onClick={startNewConversation}
                  data-testid="button-helpbot-new-chat"
                >
                  New Chat
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <div 
                className="flex-1 relative rounded-xl overflow-hidden"
                style={{ 
                  background: 'rgba(22, 37, 79, 0.6)',
                  border: '1px solid rgba(0, 191, 255, 0.2)'
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={isLoading}
                  className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder-[#667D9D] outline-none"
                  data-testid="input-helpbot-message"
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                style={{
                  background: input.trim() && !isLoading 
                    ? 'linear-gradient(135deg, #00BFFF, #0080FF)' 
                    : 'rgba(22, 37, 79, 0.6)',
                  boxShadow: input.trim() && !isLoading 
                    ? '0 0 20px rgba(0, 191, 255, 0.4)' 
                    : 'none'
                }}
                data-testid="button-helpbot-send"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <Send className="h-5 w-5 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(widgetContent, document.body);
}
