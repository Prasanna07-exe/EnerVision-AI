import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, MessageSquare, Terminal, Eye, EyeOff } from "lucide-react";
import { ApiService, API_BASE_URL } from "../../services/api";
import type { ChatMessage, AgentThought, Country } from "../../services/api";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from "recharts";

interface ChatItem extends ChatMessage {
  thoughts?: AgentThought[];
  showThoughts?: boolean;
}

const renderTextWithLinksAndBold = (text: string) => {
  const parts: React.ReactNode[] = [];
  const regex = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)/g;
  let match;
  let lastIndex = 0;
  let keyIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    if (match[1]) {
      const linkText = match[2];
      const linkUrl = match[3];
      const isRelativeApi = linkUrl.startsWith("/");
      let href = linkUrl;
      if (isRelativeApi) {
        const base = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
        href = `${base}${linkUrl}`;
      }

      parts.push(
        <a
          key={`link-${keyIndex++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neonBlue hover:underline font-semibold bg-neonBlue/10 hover:bg-neonBlue/20 px-2 py-0.5 rounded border border-neonBlue/20 transition-colors"
        >
          {linkText}
        </a>
      );
    } else if (match[4]) {
      const boldText = match[5];
      parts.push(
        <strong key={`bold-${keyIndex++}`} className="text-white font-bold">
          {boldText}
        </strong>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

const renderFormattedText = (text: string) => {
  return text.split("\n\n").map((para, pIdx) => {
    if (para.trim().startsWith("*") || para.trim().startsWith("-")) {
      return (
        <ul key={pIdx} className="list-disc pl-4 space-y-1.5 my-2">
          {para.split("\n").map((li, lIdx) => {
            const cleanLi = li.trim().replace(/^[\*\-]\s+/, "");
            return <li key={lIdx}>{renderTextWithLinksAndBold(cleanLi)}</li>;
          })}
        </ul>
      );
    }
    return (
      <p key={pIdx} className="mb-2 last:mb-0">
        {renderTextWithLinksAndBold(para)}
      </p>
    );
  });
};

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

  // Sovereign PDF Briefing state
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedBriefCountry, setSelectedBriefCountry] = useState<string>("IND");

  useEffect(() => {
    const fetchCountriesList = async () => {
      try {
        const res = await ApiService.getCountries();
        setCountries(res);
        if (res.length > 0) {
          const hasInd = res.some(c => c.code === "IND");
          setSelectedBriefCountry(hasInd ? "IND" : res[0].code);
        }
      } catch (err) {
        console.error("Failed to load country list for briefs:", err);
      }
    };
    fetchCountriesList();
  }, []);

  const handleDownloadBrief = () => {
    const base = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
    const href = `${base}/api/v1/copilot/report/download/${selectedBriefCountry}`;
    window.open(href, "_blank");
  };

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
    <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)] max-w-4xl mx-auto glass-panel border-glassBorder overflow-hidden">
      {/* Workspace Header */}
      <div className="p-4 border-b border-glassBorder flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-darkBg/30 animate-fade-in">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-neonBlue" />
          <div>
            <h4 className="font-bold text-white text-sm">Energy Copilot</h4>
            <span className="text-[10px] text-slate-500">Autonomous Collaborative Reasoning Layer</span>
          </div>
        </div>

        {/* Sovereign Briefing PDF Generator */}
        <div className="flex items-center gap-2">
          {countries.length > 0 && (
            <select
              value={selectedBriefCountry}
              onChange={(e) => setSelectedBriefCountry(e.target.value)}
              className="bg-darkBg border border-glassBorder rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-neonBlue cursor-pointer"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleDownloadBrief}
            className="flex items-center gap-1.5 bg-neonBlue/10 hover:bg-neonBlue/20 text-neonBlue border border-neonBlue/30 hover:border-neonBlue px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200"
            title="Download Academic Sovereign Briefing PDF"
          >
            <Sparkles className="w-3.5 h-3.5 text-neonBlue animate-pulse" /> Export Briefing PDF
          </button>
          
          <span className="text-[10px] text-neonGreen bg-neonGreen/10 border border-neonGreen/20 px-2 py-1 rounded-lg font-semibold">
            Qwen 2.5 Active
          </span>
        </div>
      </div>

      {/* Messages Pane */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          
          let messageText = msg.content;
          let chartConfig: any = null;
          
          if (typeof messageText === "string") {
            const chartMatch = messageText.match(/<chart_data>([\s\S]*?)<\/chart_data>/);
            if (chartMatch) {
              try {
                const cleanedJson = chartMatch[1]
                  .replace(/\/\/.*$/gm, "")
                  .replace(/\/\*[\s\S]*?\*\//g, "")
                  .trim();
                chartConfig = JSON.parse(cleanedJson);
                messageText = messageText.replace(/<chart_data>[\s\S]*?<\/chart_data>/g, "").trim();
              } catch (e) {
                console.error("Failed to parse inline chart JSON:", e);
              }
            }
          }

          return (
            <div key={idx} className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-2`}>
              
              {/* Message Bubble */}
              <div 
                className={`max-w-[85%] rounded-xl px-5 py-3 text-sm leading-relaxed ${
                  isUser 
                    ? "bg-gradient-to-r from-cyanAccent to-neonBlue text-darkBg font-semibold shadow-neon" 
                    : "glass-panel bg-glassBg/45 border-glassBorder/60 text-slate-200"
                }`}
              >
                {/* Simple Markdown Converter for paragraphs/bullets/bold/links */}
                {typeof messageText === "string" ? (
                  renderFormattedText(messageText)
                ) : (
                  messageText
                )}

                {/* Inline Recharts Chart */}
                {chartConfig && (
                  <div className="mt-4 bg-darkBg/60 border border-glassBorder/40 rounded-lg p-4 space-y-3 w-full min-w-[280px] md:min-w-[400px]">
                    <h5 className="font-bold text-white text-xs text-center">{chartConfig.title}</h5>
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {chartConfig.type === "bar" ? (
                          <BarChart data={chartConfig.data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                            <XAxis dataKey={chartConfig.xAxis || "year"} stroke="#475569" tickLine={false} style={{ fontSize: '9px' }} />
                            <YAxis stroke="#475569" tickLine={false} style={{ fontSize: '9px' }} />
                            <Tooltip contentStyle={{ background: "#0d1426", borderColor: "rgba(255,255,255,0.08)" }} itemStyle={{ color: "#fff" }} />
                            {chartConfig.series.map((sName: string, sIdx: number) => {
                              const colors = ["#00f2fe", "#ff416c", "#39ff14", "#ffb300"];
                              return (
                                <Bar key={sName} dataKey={sName} fill={colors[sIdx % colors.length]} radius={[4, 4, 0, 0]} />
                              );
                            })}
                          </BarChart>
                        ) : (
                          <LineChart data={chartConfig.data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                            <XAxis dataKey={chartConfig.xAxis || "year"} stroke="#475569" tickLine={false} style={{ fontSize: '9px' }} />
                            <YAxis stroke="#475569" tickLine={false} style={{ fontSize: '9px' }} />
                            <Tooltip contentStyle={{ background: "#0d1426", borderColor: "rgba(255,255,255,0.08)" }} itemStyle={{ color: "#fff" }} />
                            {chartConfig.series.map((sName: string, sIdx: number) => {
                              const colors = ["#00f2fe", "#39ff14", "#ff416c", "#ffb300"];
                              return (
                                <Line key={sName} type="monotone" dataKey={sName} stroke={colors[sIdx % colors.length]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                              );
                            })}
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
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
