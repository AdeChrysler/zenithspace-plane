/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import { Bot, Check, Copy, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
// plane imports
// eslint-disable-next-line import/no-unresolved
import { Tooltip } from "@plane/propel/tooltip";
// eslint-disable-next-line import/no-unresolved
import { cn, copyTextToClipboard } from "@plane/utils";
// services
import type { TAgentRequest, TAgentStreamChunk } from "@/services/agent.service";
import { AgentService } from "@/services/agent.service";

const agentService = new AgentService();

type TAgentResponseProps = {
  request: TAgentRequest;
  onResponseComplete?: (response: string) => void;
};

export const AgentStreamingResponse = observer(function AgentStreamingResponse(props: TAgentResponseProps) {
  const { request, onResponseComplete } = props;
  const [response, setResponse] = useState("");
  const [thinking, setThinking] = useState("");
  const [isStreaming, setIsStreaming] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const responseRef = useRef("");
  const containerRef = useRef<HTMLDivElement>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsStreaming(true);
    setResponse("");
    setThinking("");
    setError(null);
    responseRef.current = "";

    void agentService.streamAgentResponse(
      request,
      (chunk: TAgentStreamChunk) => {
        switch (chunk.type) {
          case "thinking":
            setThinking(chunk.content);
            break;
          case "text":
            responseRef.current += chunk.content;
            setResponse(responseRef.current);
            // Auto-scroll
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
            break;
          case "error":
            setError(chunk.content);
            break;
        }
      },
      () => {
        setIsStreaming(false);
        setThinking("");
        onResponseComplete?.(responseRef.current);
      },
      (err) => {
        setError(err);
        setIsStreaming(false);
      },
      controller.signal
    );

    return () => { controller.abort(); };
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await copyTextToClipboard(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsStreaming(true);
    setResponse("");
    setThinking("");
    setError(null);
    responseRef.current = "";

    void agentService.streamAgentResponse(
      request,
      (chunk) => {
        if (chunk.type === "text") {
          responseRef.current += chunk.content;
          setResponse(responseRef.current);
        } else if (chunk.type === "thinking") {
          setThinking(chunk.content);
        } else if (chunk.type === "error") {
          setError(chunk.content);
        }
      },
      () => {
        setIsStreaming(false);
        setThinking("");
        onResponseComplete?.(responseRef.current);
      },
      (err) => {
        setError(err);
        setIsStreaming(false);
      },
      controller.signal
    );
  };

  return (
    <div className="relative my-2 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-6 rounded-md bg-primary/10">
            <Bot className="size-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium text-primary">ZenithAgent</span>
          {isStreaming && (
            <div className="flex items-center gap-1 text-xs text-secondary">
              <Sparkles className="size-3 animate-pulse" />
              <span>Generating...</span>
            </div>
          )}
        </div>

        {!isStreaming && response && (
          <div className="flex items-center gap-1">
            <Tooltip tooltipContent="Copy response">
              <button
                onClick={() => void handleCopy()}
                className="p-1 rounded hover:bg-layer-3 transition-colors"
              >
                {copied ? (
                  <Check className="size-3.5 text-green-500" />
                ) : (
                  <Copy className="size-3.5 text-secondary" />
                )}
              </button>
            </Tooltip>
            <Tooltip tooltipContent="Regenerate">
              <button onClick={handleRetry} className="p-1 rounded hover:bg-layer-3 transition-colors">
                <RefreshCw className="size-3.5 text-secondary" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Thinking indicator */}
      {thinking && (
        <div className="px-4 py-2 text-xs text-secondary italic border-b border-primary/5 bg-primary/[0.02]">
          <span className="animate-pulse">{thinking}</span>
        </div>
      )}

      {/* Response body */}
      {/* eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */}
      <div ref={containerRef} className={cn("px-4 py-3 max-h-[400px] overflow-y-auto")}>
        {error ? (
          <div className="flex items-center gap-2 text-sm text-danger-primary">
            <span>{error}</span>
            <button onClick={handleRetry} className="text-xs underline hover:no-underline">
              Retry
            </button>
          </div>
        ) : response ? (
          <div className="prose prose-sm max-w-none text-primary whitespace-pre-wrap">
            {response}
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-primary animate-[blink_1s_infinite] ml-0.5 align-middle" />
            )}
          </div>
        ) : isStreaming ? (
          <div className="flex items-center gap-2 py-2">
            <div className="flex gap-1">
              <span className="size-2 rounded-full bg-primary/40 animate-[bounce_1.4s_infinite_0ms]" />
              <span className="size-2 rounded-full bg-primary/40 animate-[bounce_1.4s_infinite_200ms]" />
              <span className="size-2 rounded-full bg-primary/40 animate-[bounce_1.4s_infinite_400ms]" />
            </div>
            <span className="text-xs text-secondary">ZenithAgent is thinking...</span>
          </div>
        ) : null}
      </div>
    </div>
  );
});
