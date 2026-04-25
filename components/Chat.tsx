"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, RotateCcw } from "lucide-react";
import ChatMessage, { Message, Role } from "./ChatMessage";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Parse an SSE stream from /api/chat. Supports two upstream shapes:
 *   1. OpenAI-style:   `data: { choices: [{ delta: { content } }] }`
 *   2. Plain text:     `data: <chunk>`
 * Returns the newly appended content for each chunk.
 */
async function* parseSSE(
  response: Response
): AsyncGenerator<string, void, void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (!line || line === "[DONE]") continue;

      try {
        const json = JSON.parse(line);
        const delta =
          json?.choices?.[0]?.delta?.content ??
          json?.choices?.[0]?.message?.content ??
          json?.delta ??
          json?.content ??
          "";
        if (typeof delta === "string" && delta.length > 0) yield delta;
      } catch {
        // Not JSON — yield raw text
        yield line;
      }
    }
  }
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: uid(),
      role: "assistant",
      content:
        "Willkommen! Ich bin der **Abraxas ISDP Wissensagent**. " +
        "Stellen Sie mir Fragen zu Informationssicherheit und Datenschutz, " +
        "laden Sie eigene Dokumente hoch und ich arbeite damit."
    }
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;

    const userMsg: Message = { id: uid(), role: "user", content };
    const assistantMsg: Message = {
      id: uid(),
      role: "assistant",
      content: ""
    };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setInput("");
    setError(null);
    setSending(true);

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.role !== "system")
        .map(({ role, content }) => ({ role: role as Role, content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Chat fehlgeschlagen (${res.status})`);
      }

      let accumulated = "";
      for await (const chunk of parseSSE(res)) {
        accumulated += chunk;
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantMsg.id
              ? { ...msg, content: accumulated }
              : msg
          )
        );
      }
    } catch (err: any) {
      setError(err?.message ?? "Ein Fehler ist aufgetreten.");
      setMessages((m) => m.filter((msg) => msg.id !== assistantMsg.id));
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function reset() {
    setMessages([
      {
        id: uid(),
        role: "assistant",
        content:
          "Gespräch zurückgesetzt. Wie kann ich Ihnen bei Ihrer ISDP-Arbeit helfen?"
      }
    ]);
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-abraxas-100 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-abraxas-100 bg-gradient-to-r from-abraxas-50 to-white">
        <div>
          <div className="text-xs uppercase tracking-wider text-abraxas-500">
            Aktiver Agent
          </div>
          <div className="font-semibold text-abraxas-900">
            AX_ISDP_Orchestrate_Agent
          </div>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-sm text-abraxas-600 hover:text-abraxas-900"
          title="Gespräch zurücksetzen"
        >
          <RotateCcw size={14} />
          Zurücksetzen
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        {error && (
          <div className="my-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-abraxas-100 bg-abraxas-50/50 p-3">
        <div className="flex items-end gap-2 bg-white border border-abraxas-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-abraxas-500">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Frage an den ISDP-Agenten… (Shift+Enter für Zeilenumbruch)"
            className="flex-1 resize-none bg-transparent outline-none px-2 py-1.5 text-abraxas-900 placeholder:text-abraxas-400 max-h-40"
            disabled={sending}
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="flex-shrink-0 bg-abraxas-600 hover:bg-abraxas-700 disabled:opacity-50 text-white rounded-lg p-2 transition"
            aria-label="Senden"
          >
            {sending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <div className="text-[11px] text-abraxas-400 mt-1.5 px-1">
          Antworten werden von watsonx Orchestrate generiert und können ungenau sein.
          Bitte kritische Informationen anhand der Quelldokumente überprüfen.
        </div>
      </div>
    </div>
  );
}
