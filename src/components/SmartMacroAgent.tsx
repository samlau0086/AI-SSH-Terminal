import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, X, CheckCircle, AlertCircle } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import type { AISettings } from './SettingsModal';

interface Props {
  goal: string;
  terminalContext: string;
  onExecuteCommand: (cmd: string) => void;
  onFinish: () => void;
  aiSettings: AISettings;
}

export default function SmartMacroAgent({ goal, terminalContext, onExecuteCommand, onFinish, aiSettings }: Props) {
  const [status, setStatus] = useState<'running' | 'done' | 'error'>('running');
  const [statusMessage, setStatusMessage] = useState('Initializing...');
  const [actionHistory, setActionHistory] = useState<string[]>([]);
  const lastAnalyzedContext = useRef<string>('');
  const isAnalyzing = useRef<boolean>(false);

  useEffect(() => {
    if (status !== 'running') return;
    
    // Wait for terminal context to settle
    const timer = setTimeout(() => {
      analyzeContext();
    }, 1500);

    return () => clearTimeout(timer);
  }, [terminalContext, status]);

  const analyzeContext = async () => {
    if (isAnalyzing.current || status !== 'running') return;
    
    // Simple heuristic to not spam if context hasn't changed much
    if (lastAnalyzedContext.current === terminalContext) return;
    
    isAnalyzing.current = true;
    lastAnalyzedContext.current = terminalContext;
    setStatusMessage('Analyzing terminal...');

    try {
      const prompt = `You are an AI automated terminal agent that executes multi-step macros.
Macro Goal / Instructions:
${goal}

Execution History (Actions taken so far):
${actionHistory.length > 0 ? actionHistory.map((h, i) => `${i + 1}. ${h}`).join('\n') : "No actions taken yet."}

Current terminal output (last bits):
\`\`\`
${terminalContext.slice(-2500)}
\`\`\`

Analyze the terminal output and decide the next action to progress through the instructions.
If the terminal is prompting for user input (like a password, a confirmation [y/N], or a selection), or if it is at a regular shell prompt and ready for the next step, provide the exact string to type. ALWAYS include a newline character ("\\n") at the end if you want to press enter in the command. If you only want to type but NOT press enter, DO NOT include "\\n".
If the terminal is currently processing a command and NOT waiting for input, output action "wait".
If ALL steps of the macro goal are fully achieved and the terminal is back to a regular shell prompt, output action "done".

Output ONLY a raw JSON object with this exact structure (no markdown fences, no extra text):
{
  "action": "type" | "wait" | "done",
  "command": "input to type",
  "reason": "short explanation of what you are doing"
}`;

      let aiResponseText = "";

      if (aiSettings.provider === 'openai') {
         const client = new OpenAI({
            apiKey: aiSettings.apiKey || '',
            baseURL: aiSettings.baseUrl || undefined,
            dangerouslyAllowBrowser: true
         });
         const res = await client.chat.completions.create({
            model: aiSettings.model || 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
         });
         aiResponseText = res.choices[0]?.message.content || '{}';
      } else {
         const GenAI = new GoogleGenAI({ apiKey: aiSettings.apiKey || process.env.GEMINI_API_KEY });
         const res = await GenAI.models.generateContent({
            model: aiSettings.model || 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
         });
         aiResponseText = res.text || '{}';
      }

      const jsonStr = aiResponseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(jsonStr);

      if (parsed.action === 'done') {
         setStatus('done');
         setStatusMessage('Goal achieved!');
         setActionHistory(h => [...h, `Done: ${parsed.reason || 'completed'}`]);
      } else if (parsed.action === 'type' && parsed.command) {
         setStatusMessage(`Executing: ${parsed.reason || 'typing...'}`);
         setActionHistory(h => [...h, `Typed: ${parsed.command.replace(/\n/g, '\\n')} (Reason: ${parsed.reason})`]);
         onExecuteCommand(parsed.command);
      } else {
         setStatusMessage(`Waiting: ${parsed.reason || 'processing...'}`);
      }
      
    } catch (err: any) {
      console.error("Smart Macro Error:", err);
      // Wait a bit before retrying on error
      setStatusMessage(`Retry: ${err?.message || 'Error occurred'}`);
      lastAnalyzedContext.current = ''; 
    } finally {
      isAnalyzing.current = false;
    }
  };

  return (
    <div className="fixed bottom-6 right-6 w-80 bg-white dark:bg-[#18181b] border border-indigo-500/50 shadow-2xl rounded-xl p-4 z-50 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-500 flex items-center gap-2">
          <Bot className="w-4 h-4" />
          Smart Macro
        </h3>
        <button onClick={onFinish} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="text-sm text-zinc-700 dark:text-zinc-300 font-medium line-clamp-2">
        {goal}
      </div>

      <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-50 dark:bg-[#09090b] p-2 rounded border border-zinc-200 dark:border-zinc-800">
        {status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
        {status === 'done' && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
        {status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
        <span className="truncate">{statusMessage}</span>
      </div>

      {actionHistory.length > 0 && (
        <div className="text-[10px] text-zinc-500 font-mono mt-1 max-h-24 overflow-y-auto custom-scrollbar border-l-2 border-indigo-500/30 pl-2">
          {actionHistory.map((a, i) => (
            <div key={i} className="mb-1 truncate opacity-80" title={a}>{i + 1}. {a}</div>
          ))}
        </div>
      )}
      
      {status === 'done' && (
        <button 
          onClick={onFinish}
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white text-xs py-1.5 rounded-md transition-colors"
        >
          Close
        </button>
      )}
    </div>
  );
}
