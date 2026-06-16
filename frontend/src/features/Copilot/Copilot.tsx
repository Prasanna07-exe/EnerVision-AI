import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, MessageSquare, Terminal, Eye, EyeOff } from "lucide-react";
import { ApiService } from "../../services/api";
import type { ChatMessage, AgentThought } from "../../services/api";

interface ChatItem extends ChatMessage {
  thoughts?: AgentThought[];
  showThoughts?: boolean;
}

export const Copilot: React.FC = () => {
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      role: "assistant",
      content: (
        "Welcome to the **EnerVision AI Copilot Workspace**.\n\n" +
        "I am connected to your local database registry and trained models. Ask me questions about global transition metrics, model forecasts, or policy simulation parameters (e.g., *'Why are emissions rising in India?'* or *'Compare China and USA'*)."
      )
    }
  ]);
  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const promptChips = [
    "Why are emissions increasing in China?",
    "Compare USA and Germany renewable shares",
    "What will India's demand look like by 2040?"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (messageText: string) => {
    if (!messageText.trim()) return;

    const userMsg: ChatItem = { role: "user", content: messageText };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Format context history
      const historyPayload = messages.map(m => ({
        role: m.role,
        content: m.content as string
      }));

      const res = await ApiService.chat(messageText, historyPayload);
      
      const assistantMsg: ChatItem = {
        role: "assistant",
        content: res.response,
        thoughts: res.thoughts,
        showThoughts: true // Open thought logs by default to showcase architecture
      };
      
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatItem = {
        role: "assistant",
        content: "🚨 Failed to reach local LLM host. Please verify Ollama is active and responsive."
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const toggleThoughts = (index: number) => {
    setMessages(prev => prev.map((m, idx) => {
      if (idx === index) {
        return { ...m, showThoughts: !m.showThoughts };
      }
      return m;
    }));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-w-4xl mx-auto glass-panel border-glassBorder overflow-hidden">
      {/* Workspace Header */}
      <div className="p-4 border-b border-glassBorder flex items-center justify-between bg-darkBg/30">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-neonBlue" />
          <div>
            <h4 className="font-bold text-white text-sm">Energy Copilot</h4>
            <span className="text-[10px] text-slate-500">Autonomous Collaborative Reasoning Layer</span>
          </div>
        </div>
        <span className="text-[10px] text-neonGreen bg-neonGreen/10 border border-neonGreen/20 px-2 py-0.5 rounded-lg font-semibold animate-pulse">
          Qwen 2.5 Active
        </span>
      </div>

      {/* Messages Pane */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          return (
            <div key={idx} className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-2`}>
              
              {/* Message Bubble */}
              <div 
                className={`max-w-[85%] rounded-xl px-5 py-3.5 text-sm leading-relaxed ${
                  isUser 
                    ? "bg-secondary-color text-white shadow-neon" 
                    : "glass-panel bg-glassBg/40 border-glassBorder/80 text-slate-200"
                }`}
              >
                {/* Simple Markdown Converter for paragraphs/bullets/bold */}
                {typeof msg.content === "string" ? (
                  msg.content.split("\n\n").map((para, pIdx) => {
                    if (para.startsWith("*") || para.startsWith("-")) {
                      return (
                        <ul key={pIdx} className="list-disc pl-4 space-y-1.5 my-2">
                          {para.split("\n").map((li, lIdx) => (
                            <li key={lIdx}>{li.replace(/^[\*\-]\s+/, "")}</li>
                          ))}
                        </ul>
                      );
                    }
                    return (
                      <p key={pIdx} className="mb-2 last:mb-0">
                        {para.split("**").map((chunk, cIdx) => 
                          cIdx % 2 === 1 ? <strong key={cIdx} className="text-white font-bold">{chunk}</strong> : chunk
                        )}
                      </p>
                    );
                  })
                ) : (
                  msg.content
                )}
              </div>

              {/* Sub-Agent Diagnostic Thoughts Accordion */}
              {!isUser && msg.thoughts && msg.thoughts.length > 0 && (
                <div className="w-[85%] glass-panel border-glassBorder/40 bg-darkBg/20 text-xs overflow-hidden rounded-lg">
                  <button 
                    onClick={() => toggleThoughts(idx)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-darkBg/40 hover:bg-glassBg/20 text-slate-500 font-semibold transition-all duration-200"
                  >
                    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
                      <Terminal className="w-3.5 h-3.5" /> Collaborative Thoughts Trace
                    </span>
                    {msg.showThoughts ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  {msg.showThoughts && (
                    <div className="p-3 space-y-2.5 border-t border-glassBorder/20">
                      {msg.thoughts.map((t, tIdx) => (
                        <div key={tIdx} className="space-y-0.5 border-l border-glassBorder/80 pl-2">
                          <span className="font-bold text-[10px] text-neonBlue uppercase tracking-wider block">
                            {t.agent_name}
                          </span>
                          <p className="text-slate-400 leading-snug">{t.thought}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          );
        })}
        {loading && (
          <div className="flex items-center gap-3">
            <div className="glass-panel bg-glassBg/40 border-glassBorder/80 px-4 py-3 rounded-xl flex gap-1.5 items-center">
              <span className="w-2 h-2 bg-neonBlue rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-neonBlue rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-neonBlue rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold animate-pulse">
              Agents coordinating...
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Control Box */}
      <div className="p-4 border-t border-glassBorder bg-darkBg/30 space-y-4">
        {/* Quick Prompt Chips */}
        {messages.length === 1 && !loading && (
          <div className="flex flex-wrap gap-2">
            {promptChips.map((chip, cIdx) => (
              <button
                key={cIdx}
                onClick={() => handleSend(chip)}
                className="text-xs bg-glassBg/40 border border-glassBorder hover:border-neonBlue/30 text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3 text-neonBlue" /> {chip}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="flex gap-4">
          <input
            type="text"
            value={input}
            disabled={loading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
            placeholder="Ask a question about energy projections..."
            className="flex-1 bg-darkBg border border-glassBorder rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-neonBlue disabled:opacity-50"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={loading || !input.trim()}
            className="bg-neonBlue hover:brightness-110 text-darkBg font-bold p-3 rounded-xl flex items-center justify-center transition-all duration-200 shadow-neon disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
