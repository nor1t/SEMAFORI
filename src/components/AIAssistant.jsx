import React, { useState, useRef, useEffect } from 'react';
import { generateTrafficAdvice, analyzeTrafficPattern } from '../services/groqService';

const AIAssistant = ({ reports, onClose }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      content: 'Përshëndetje! Unë jam Asistenti juaj i AI-së për Trafikun. Mund të të ndihmoj me analizën e incidenteve, të jap rekomandime dhe të përgjigjem në pyetje rreth menaxhimit të trafikut. Si mund të të ndihmoj sot?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (content, type = 'user') => {
    const newMessage = {
      id: Date.now(),
      type,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    addMessage(userMessage, 'user');
    setIsLoading(true);

    try {
      let response = '';

      // Check for specific commands
      if (userMessage.toLowerCase().includes('analyze') || userMessage.toLowerCase().includes('pattern')) {
        response = await analyzeTrafficPattern(reports);
      } else if (userMessage.toLowerCase().includes('advice') || userMessage.toLowerCase().includes('recommend')) {
        // Get the most recent incident for advice
        const recentIncident = reports[0];
        if (recentIncident) {
          response = await generateTrafficAdvice(recentIncident);
        } else {
          response = "Nuk ka incidente të fundit për të dhënë këshilla. Ju lutem krijoni një raport incidenti së pari.";
        }
      } else {
        // General traffic management questions
        const prompt = `Si një asistent AI për menaxhimin e trafikut, përgjigju në këtë pyetje në mënyrë profesionale dhe koncize: ${userMessage}`;

        const { groq } = await import('../services/groqService');
        if (groq) {
          const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'mixtral-8x7b-32768',
            temperature: 0.7,
            max_tokens: 200,
          });
          response = completion.choices[0]?.message?.content || "Më vjen keq, nuk mund ta përpunoj këtë kërkesë.";
        } else {
          response = "Veçoritë e AI-së nuk janë të disponueshme. Ju lutem kontrolloni konfigurimin e çelësit tuaj të Groq.";
        }
      }

      addMessage(response, 'ai');
    } catch (error) {
      console.error('AI Error:', error);
      let errorMessage = "Më vjen keq, hasa në një gabim.";

      if (!navigator.onLine) {
        errorMessage = "Jeni offline. Kontrolloni lidhjen tuaj të internetit.";
      } else if (error.message.includes('timeout') || error.message.includes('network')) {
        errorMessage = "Kërkesa ka skaduar. Provoni përsëri.";
      } else if (error.message.includes('API key') || error.message.includes('authentication')) {
        errorMessage = "Problem me autentifikimin e AI-së. Kontrolloni konfigurimin.";
      }

      addMessage(errorMessage, 'ai');
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: 'Analizo Modelet', message: 'Analizo modelet aktuale të trafikut dhe jep njohuri.' },
    { label: 'Merr Këshilla', message: 'Më jep këshilla për trajtimin e incidentit të fundit.' },
    { label: 'Këshilla Trafiku', message: 'Cilat janë disa praktika më të mira për menaxhimin e trafikut?' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-3xl border border-slate-700 w-full max-w-2xl h-[600px] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-white text-lg">🤖</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Asistenti AI për Trafikun</h3>
              <p className="text-sm text-slate-400">Powered by Groq</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                message.type === 'user'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-800 text-slate-200'
              }`}>
                <p className="text-sm">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        {messages.length === 1 && (
          <div className="px-6 pb-4">
            <p className="text-sm text-slate-400 mb-3">Veprimet e shpejta:</p>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => setInput(action.message)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-full transition"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-6 border-t border-slate-700">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pyetmë për menaxhimin e trafikut..."
              className="flex-1 bg-slate-800 border border-slate-600 rounded-full px-4 py-3 text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-12 h-12 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-full flex items-center justify-center text-slate-950 transition"
            >
              {isLoading ? (
                <div className="w-4 h-4 border border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                '➤'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;