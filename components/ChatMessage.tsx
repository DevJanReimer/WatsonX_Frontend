"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Bot, User } from "lucide-react";
import clsx from "clsx";

export type Role = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: Role;
  content: string;
  sources?: { title: string; url?: string; snippet?: string }[];
}

interface Props {
  message: Message;
  isLoading?: boolean;
}

const LOADING_WORDS = [
  "Abraxing",
  "Securing",
  "Orchestrating",
  "Analysing",
  "Synthesizing",
  "Encrypting",
  "Compliance-checking",
  "Knowledge-mining",
  "Vectorizing",
  "Thinking",
  "Processing",
];

function LoadingWords() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const cycle = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % LOADING_WORDS.length);
        setVisible(true);
      }, 300);
    }, 1800);
    return () => clearInterval(cycle);
  }, []);

  return (
    <span
      className="italic text-abraxas-500 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {LOADING_WORDS[index]}…
    </span>
  );
}

export default function ChatMessage({ message, isLoading }: Props) {
  const isUser = message.role === "user";

  return (
    <div
      className={clsx(
        "flex gap-3 py-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={clsx(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-abraxas-600 text-white"
            : "bg-abraxas-100 text-abraxas-700 border border-abraxas-200"
        )}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div
        className={clsx(
          "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm",
          isUser
            ? "bg-abraxas-600 text-white rounded-tr-sm"
            : "bg-white text-abraxas-900 rounded-tl-sm border border-abraxas-100"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
        ) : (
          <div className="prose-chat text-[0.95rem]">
            {isLoading ? (
              <LoadingWords />
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
              >
                {(message.content || "…").replace(/<br\s*\/?>/gi, "\n")}
              </ReactMarkdown>
            )}
          </div>
        )}

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-abraxas-100">
            <div className="text-xs font-semibold uppercase tracking-wider text-abraxas-500 mb-2">
              Quellen
            </div>
            <ul className="space-y-1">
              {message.sources.map((s, i) => (
                <li key={i} className="text-sm">
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-abraxas-600 hover:underline"
                    >
                      {s.title}
                    </a>
                  ) : (
                    <span className="text-abraxas-700">{s.title}</span>
                  )}
                  {s.snippet && (
                    <span className="text-abraxas-500"> — {s.snippet}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
