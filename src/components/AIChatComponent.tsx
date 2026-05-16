import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Command, ArrowRight, Play, Rocket, Activity, Check } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { cn } from '../lib/utils';
import Markdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import type { AISettings } from './SettingsModal';

interface Props {
  terminalContext: string;
  onExecuteCommand?: (cmd: string) => void;
  aiSettings: AISettings;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// Global default AI
const globalGeminiApiKey = process.env.GEMINI_API_KEY;

export default function AIChatComponent({ terminalContext, onExecuteCommand, aiSettings }: Props) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: t('chat.welcome')
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendPrompt = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg = text.trim();
    const newMessages: Message[] = [...messages, { id: Date.now().toString(), role: 'user', content: userMsg }];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const systemPrompt = `You are an expert DevOps and Systems Administrator AI assistant. You have context of the user's current SSH terminal session.
If the user asks for a command, provide it clearly.
Format your responses using Markdown. Use \`code\` blocks for commands.
Current Terminal Context (last output lines):
\`\`\`
${terminalContext || "No terminal context available yet."}
\`\`\``;

      let aiResponseText = "";

      if (aiSettings.provider === 'openai') {
        const oaiApiKey = aiSettings.apiKey;
        if (!oaiApiKey) throw new Error("API Key for OpenAI/Custom is missing.");
        
        const client = new OpenAI({
          apiKey: oaiApiKey,
          baseURL: aiSettings.baseUrl || undefined,
          dangerouslyAllowBrowser: true // This is needed to run OpenAI from the browser side
        });

        const oaiMessages: any[] = [
          { role: 'system', content: systemPrompt },
          ...newMessages.slice(-6).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          }))
        ];

        let completion: any;
        try {
          completion = await client.chat.completions.create({
            messages: oaiMessages,
            model: aiSettings.model || 'gpt-4o',
          });
        } catch (apiError: any) {
          // If OpenAI SDK throws an error that contains HTML
          if (typeof apiError?.message === 'string' && apiError.message.includes('<!DOCTYPE html')) {
             throw new Error(`The API returned an HTML webpage instead of JSON. This usually means the Base URL is incorrect. Please try appending "/v1" to your Base URL in the settings (e.g., ${aiSettings.baseUrl?.replace(/\/$/, '')}/v1).`);
          }
          throw apiError;
        }

        if (typeof completion === 'string' || !completion?.choices?.length) {
          const responseStr = typeof completion === 'string' ? completion : JSON.stringify(completion);
          if (responseStr.toLowerCase().includes('<!doctype html') || responseStr.includes('<html')) {
            throw new Error(`The API returned an HTML webpage instead of JSON. This usually means the Base URL is incorrect. Please try appending "/v1" to your Base URL in the settings (e.g., ${aiSettings.baseUrl?.replace(/\/$/, '')}/v1).`);
          }
          throw new Error(
            "Invalid response from AI API: " + 
            ((completion as any)?.error?.message || responseStr)
          );
        }

        aiResponseText = completion.choices[0]?.message?.content || "No response generated.";
      } else {
        // Gemini
        const geminiApiKey = aiSettings.apiKey || globalGeminiApiKey;
        if (!geminiApiKey) {
          throw new Error(t('chat.errorMissingKey'));
        }
        
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        
        const contents = newMessages.slice(-6).map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }));

        const response = await ai.models.generateContent({
          model: aiSettings.model || 'gemini-2.5-pro',
          contents: [
            { role: 'user', parts: [{ text: systemPrompt }] },
            ...contents
          ],
        });

        aiResponseText = response.text || "Sorry, I couldn't generate a response.";
      }

      setMessages([
        ...newMessages, 
        { 
          id: Date.now().toString(), 
          role: 'assistant', 
          content: aiResponseText
        }
      ]);
    } catch (error: any) {
      console.error(error);
      setMessages([
        ...newMessages, 
        { 
          id: Date.now().toString(), 
          role: 'assistant', 
          content: `**Error:** ${error.message}` 
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      const text = input;
      setInput('');
      await sendPrompt(text);
    }
  };

  const copyCommand = async (cmd: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(cmd);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = cmd;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedText(cmd);
      setTimeout(() => {
        setCopiedText(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
        <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
          <Bot className="w-4 h-4" />
          {t('chat.aiAssistant')}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0", 
              msg.role === 'user' ? "bg-zinc-800" : "bg-indigo-500/20 text-indigo-400"
            )}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={cn(
              "max-w-[85%] rounded-lg p-3 text-sm",
              msg.role === 'user' 
                ? "bg-zinc-800 text-zinc-100" 
                : "border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
            )}>
              {msg.role === 'user' ? (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none 
                  prose-p:leading-relaxed prose-pre:bg-zinc-100 prose-pre:dark:bg-black/50 prose-pre:border prose-pre:border-zinc-200 prose-pre:dark:border-zinc-800
                  prose-code:text-indigo-400 prose-code:bg-indigo-500/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
                  <Markdown
                    components={{
                      code({node, inline, className, children, ...props}: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline ? (
                          <div className="relative group mt-2 mb-4">
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              {onExecuteCommand && (
                                <button
                                  onClick={() => onExecuteCommand(String(children).replace(/\n$/, ''))}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white p-1.5 rounded-md text-[10px] flex items-center gap-1"
                                >
                                  <Play className="w-3 h-3" />
                                  {t('chat.run')}
                                </button>
                              )}
                              <button
                                onClick={() => copyCommand(String(children).replace(/\n$/, ''))}
                                className="bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 p-1.5 rounded-md text-[10px] flex items-center gap-1"
                              >
                                {copiedText === String(children).replace(/\n$/, '') ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                                    <span className="text-emerald-500 dark:text-emerald-400">{t('Copied') as string || 'Copied'}</span>
                                  </>
                                ) : (
                                  <>
                                    <Command className="w-3 h-3" />
                                    {t('chat.copy')}
                                  </>
                                )}
                              </button>
                            </div>
                            <pre className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-3 overflow-x-auto text-xs whitespace-pre font-mono text-indigo-600 dark:text-indigo-400">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          </div>
                        ) : (
                          <code className="bg-zinc-100 dark:bg-zinc-800/50 text-indigo-600 dark:text-indigo-400 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                            {children}
                          </code>
                        )
                      }
                    }}
                  >
                    {msg.content}
                  </Markdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] flex flex-col shrink-0">
        {messages.length <= 3 && (
          <div className="flex gap-2 overflow-x-auto pb-3 custom-scrollbar">
            <button
              type="button"
              onClick={() => sendPrompt(t('chat.qaDeployGithubPrompt'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[10px] sm:text-xs text-zinc-700 dark:text-zinc-300 font-medium tracking-wide transition-colors whitespace-nowrap shrink-0"
            >
              <Rocket className="w-3.5 h-3.5 text-indigo-400" />
              {t('chat.qaDeployGithub')}
            </button>
            <button
              type="button"
              onClick={() => sendPrompt(t('chat.qaCheckSystemPrompt'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[10px] sm:text-xs text-zinc-700 dark:text-zinc-300 font-medium tracking-wide transition-colors whitespace-nowrap shrink-0"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              {t('chat.qaCheckSystem')}
            </button>
          </div>
        )}
        <div className="h-12 border border-zinc-700 rounded-lg flex items-center px-4 gap-3 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
          <span className="text-indigo-400 font-bold text-xs uppercase tracking-widest hidden sm:inline">{t('chat.aiCmd')}</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('chat.askAi')}
            className="bg-transparent flex-1 outline-none text-zinc-800 dark:text-zinc-200 text-xs h-full"
          />
          <div className="flex gap-1 shrink-0">
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="px-1.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:dark:text-zinc-500 text-zinc-500 text-white border border-transparent disabled:border-zinc-700 rounded text-[9px] transition-colors font-bold uppercase tracking-widest"
            >
              {t('chat.send')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
