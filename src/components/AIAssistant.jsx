import React, { useEffect, useRef, useState } from 'react';
import { askTrafficAssistant } from '../services/groqService';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const AIAssistant = ({ reports, onClose }) => {
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      content: t('aiGreeting'),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMessages([
      {
        id: 1,
        type: 'ai',
        content: t('aiGreeting'),
        timestamp: new Date(),
      },
    ]);
  }, [language, t]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (content, type = 'user') => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        type,
        content,
        timestamp: new Date(),
      },
    ]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    addMessage(userMessage, 'user');
    setIsLoading(true);

    try {
      const response = await askTrafficAssistant({
        message: userMessage,
        reports,
        language,
      });

      let finalMessage = response.content;

      if (response.provider === 'fallback') {
        if (!navigator.onLine) {
          finalMessage = `${t('aiOffline')} ${response.content}`;
        } else if (response.errorType === 'auth') {
          finalMessage = `${t('aiAuthError')} ${response.content}`;
        } else if (response.errorType === 'timeout') {
          finalMessage = `${t('aiTimeout')} ${response.content}`;
        } else if (response.errorType === 'network') {
          finalMessage = `${t('networkError')} ${response.content}`;
        } else {
          finalMessage = `${t('aiGenericError')} ${response.content}`;
        }
      }

      addMessage(finalMessage, 'ai');
    } catch (error) {
      console.error('AI Error:', error);
      addMessage(t('aiGenericError'), 'ai');
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: t('aiAnalyzePatterns'), message: t('aiAnalyzePatternsPrompt') },
    { label: t('aiGetAdvice'), message: t('aiGetAdvicePrompt') },
    { label: t('aiBestPractices'), message: t('aiBestPracticesPrompt') },
  ];

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${theme === 'light' ? 'bg-black/30' : 'bg-black/50'}`}>
      <div className={`flex h-[600px] w-full max-w-2xl flex-col rounded-3xl border shadow-2xl ${theme === 'light' ? 'border-slate-200 bg-white text-slate-900' : 'border-slate-700 bg-slate-900 text-white'}`}>
        <div className={`flex items-center justify-between border-b p-6 ${theme === 'light' ? 'border-slate-200' : 'border-slate-700'}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-500">
              <span className="text-lg text-white">🤖</span>
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{t('aiAssistantTitle')}</h3>
              <p className={`text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{t('aiPoweredBy')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${theme === 'light' ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 hover:text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.type === 'user'
                    ? 'bg-cyan-500 text-slate-950'
                    : theme === 'light'
                      ? 'bg-slate-100 text-slate-900'
                      : 'bg-slate-800 text-slate-200'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                <p className={`mt-1 text-xs opacity-70 ${theme === 'light' ? 'text-slate-500' : ''}`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className={`rounded-2xl px-4 py-3 ${theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-800 text-slate-200'}`}>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 animate-bounce rounded-full ${theme === 'light' ? 'bg-slate-500' : 'bg-slate-400'}`} />
                  <div className={`h-2 w-2 animate-bounce rounded-full ${theme === 'light' ? 'bg-slate-500' : 'bg-slate-400'}`} style={{ animationDelay: '0.1s' }} />
                  <div className={`h-2 w-2 animate-bounce rounded-full ${theme === 'light' ? 'bg-slate-500' : 'bg-slate-400'}`} style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {messages.length === 1 && (
          <div className="px-6 pb-4">
            <p className={`mb-3 text-sm ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{t('aiQuickActions')}</p>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => setInput(action.message)}
                  className={`rounded-full px-3 py-2 transition ${theme === 'light' ? 'bg-slate-100 text-slate-900 hover:bg-slate-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`border-t p-6 ${theme === 'light' ? 'border-slate-200' : 'border-slate-700'}`}>
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t('aiAskPlaceholder')}
              className={`flex-1 rounded-full border px-4 py-3 transition focus:border-cyan-400 focus:outline-none ${theme === 'light' ? 'border-slate-300 bg-slate-100 text-slate-900 placeholder-slate-500' : 'border-slate-600 bg-slate-800 text-slate-200 placeholder-slate-400'}`}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500 text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border border-slate-950 border-t-transparent" />
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
