/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

"use client";

import { Bot, Check, ChevronRight, Circle, Copy, Loader2, RefreshCw, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
// plane imports
// eslint-disable-next-line import/no-unresolved
import { Tooltip } from "@plane/propel/tooltip";
// eslint-disable-next-line import/no-unresolved
import { cn, copyTextToClipboard } from "@plane/utils";
// services
import type { TAgentRequest, TAgentStreamChunk } from "@/services/agent.service";
import { AgentService } from "@/services/agent.service";
import type { TAgentSessionState } from "@/hooks/use-agent-mention";

const agentService = new AgentService();

// --- Plan step types ---
type PlanStep = {
  label: string;
  status: "pending" | "active" | "completed";
};

const DEFAULT_PLAN_STEPS: PlanStep[] = [
  { label: "Analyzing issue context", status: "pending" },
  { label: "Searching codebase", status: "pending" },
  { label: "Identifying root cause", status: "pending" },
  { label: "Writing response", status: "pending" },
];

// --- Agent Calling Badge (used by activity-comment-root) ---
export function AgentCallingBadge() {
  return (
    <div className="relative flex gap-3 py-1">
      {/* Timeline connector */}
      <div className="absolute left-[13px] top-0 bottom-0 w-px bg-layer-3" aria-hidden />
      <div className="w-7 flex-shrink-0" />
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 animate-pulse">
        <Bot className="size-3.5 text-primary" />
        <span className="text-xs font-medium text-primary">Calling ZenithAgent...</span>
      </div>
    </div>
  );
}

// --- Agent Comment Block (for persisted agent comments in the activity feed) ---
type TAgentCommentBlockProps = {
  content: string;
  timestamp?: string;
  ends?: "top" | "bottom" | undefined;
};

export function AgentCommentBlock(props: TAgentCommentBlockProps) {
  const { content, timestamp, ends } = props;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await copyTextToClipboard(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`relative flex gap-3 ${ends === "top" ? "pb-2" : ends === "bottom" ? "pt-2" : "py-2"}`}
    >
      {/* Timeline line */}
      <div className="absolute left-[13px] top-0 bottom-0 w-px bg-layer-3" aria-hidden />
      {/* Timeline dot - bot icon */}
      <div className="flex-shrink-0 relative w-7 h-7 rounded-lg flex justify-center items-center z-[3] bg-primary/10 border border-primary/20 shadow-raised-100">
        <Bot className="size-3.5 text-primary" />
      </div>
      {/* Content */}
      <div className="flex flex-col gap-3 truncate flex-grow">
        <div className="text-body-sm-regular mb-2 bg-layer-2 border border-primary/10 shadow-raised-100 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-primary/5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-primary">ZenithAgent</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Bot</span>
            </div>
            <div className="flex items-center gap-2">
              {timestamp && <span className="text-xs text-tertiary">{timestamp}</span>}
              <Tooltip tooltipContent="Copy response">
                <button
                  onClick={() => void handleCopy()}
                  className="p-1 rounded hover:bg-layer-3 transition-colors"
                >
                  {copied ? (
                    <Check className="size-3 text-green-500" />
                  ) : (
                    <Copy className="size-3 text-secondary" />
                  )}
                </button>
              </Tooltip>
            </div>
          </div>
          {/* Body */}
          <div className="px-3 py-2.5 text-sm text-primary whitespace-pre-wrap">{content}</div>
        </div>
      </div>
    </div>
  );
}

// --- Streaming Response (Linear-style structured UI) ---
type TAgentResponseProps = {
  request: TAgentRequest;
  onResponseComplete?: (response: string) => void;
  onSessionStateChange?: (state: TAgentSessionState) => void;
};

export const AgentStreamingResponse = observer(function AgentStreamingResponse(props: TAgentResponseProps) {
  const { request, onResponseComplete, onSessionStateChange } = props;

  // State
  const [sessionState, setSessionState] = useState<TAgentSessionState>("calling");
  const [planSteps, setPlanSteps] = useState<PlanStep[]>(DEFAULT_PLAN_STEPS.map((s) => ({ ...s })));
  const [currentPlanIndex, setCurrentPlanIndex] = useState(-1);
  const [ephemeralThought, setEphemeralThought] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPlanCollapsed, setIsPlanCollapsed] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const responseRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync session state with parent
  const updateSessionState = useCallback(
    (state: TAgentSessionState) => {
      setSessionState(state);
      onSessionStateChange?.(state);
    },
    [onSessionStateChange]
  );

  // Advance plan to next step
  const advancePlan = useCallback(
    (toIndex: number) => {
      setPlanSteps((prev) => {
        const next = prev.map((step, i) => {
          if (i < toIndex) return { ...step, status: "completed" as const };
          if (i === toIndex) return { ...step, status: "active" as const };
          return step;
        });
        return next;
      });
      setCurrentPlanIndex(toIndex);
      setCompletedCount(toIndex);
    },
    []
  );

  // Complete all plan steps
  const completePlan = useCallback(() => {
    setPlanSteps((prev) => prev.map((step) => ({ ...step, status: "completed" as const })));
    setCompletedCount(DEFAULT_PLAN_STEPS.length);
  }, []);

  // Stream handler
  const startStream = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    updateSessionState("calling");
    setPlanSteps(DEFAULT_PLAN_STEPS.map((s) => ({ ...s })));
    setCurrentPlanIndex(-1);
    setEphemeralThought("");
    setResponse("");
    setError(null);
    setIsPlanCollapsed(false);
    setCompletedCount(0);
    responseRef.current = "";

    let hasReceivedThinking = false;
    let hasReceivedText = false;

    void agentService.streamAgentResponse(
      request,
      (chunk: TAgentStreamChunk) => {
        switch (chunk.type) {
          case "thinking":
            if (!hasReceivedThinking) {
              hasReceivedThinking = true;
              updateSessionState("working");
              advancePlan(0);
            }
            setEphemeralThought(chunk.content);
            // Advance plan steps based on thinking progress
            if (hasReceivedThinking && currentPlanIndex < 1) {
              advancePlan(1);
            }
            break;
          case "plan":
            // Server-sent plan steps override defaults
            try {
              const steps = JSON.parse(chunk.content) as string[];
              setPlanSteps(steps.map((label, i) => ({
                label,
                status: i === 0 ? "active" : "pending",
              })));
              setCurrentPlanIndex(0);
            } catch {
              // Ignore parse errors
            }
            break;
          case "text":
            if (!hasReceivedText) {
              hasReceivedText = true;
              updateSessionState("responding");
              advancePlan(DEFAULT_PLAN_STEPS.length - 1);
              setEphemeralThought("");
            }
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
        completePlan();
        updateSessionState("completed");
        setEphemeralThought("");
        setIsPlanCollapsed(true);
        onResponseComplete?.(responseRef.current);
      },
      (err) => {
        setError(err);
        updateSessionState("completed");
      },
      controller.signal
    );
  }, [request, updateSessionState, advancePlan, completePlan, onResponseComplete, currentPlanIndex]);

  // Start streaming on mount
  useEffect(() => {
    startStream();
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await copyTextToClipboard(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    startStream();
  };

  const isWorking = sessionState === "calling" || sessionState === "working";
  const isResponding = sessionState === "responding";

  // Status label
  const statusLabel = useMemo(() => {
    switch (sessionState) {
      case "calling":
        return "starting...";
      case "working":
        return "working...";
      case "responding":
        return "responding...";
      case "completed":
        return null;
      default:
        return null;
    }
  }, [sessionState]);

  return (
    <div className="relative flex gap-3 py-2">
      {/* Timeline line */}
      <div className="absolute left-[13px] top-0 bottom-0 w-px bg-layer-3" aria-hidden />
      {/* Timeline dot - bot icon */}
      <div className="flex-shrink-0 relative w-7 h-7 rounded-lg flex justify-center items-center z-[3] bg-primary/10 border border-primary/20 shadow-raised-100">
        <Bot className="size-3.5 text-primary" />
      </div>

      {/* Content card */}
      <div className="flex-grow min-w-0">
        <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-primary">ZenithAgent</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">Bot</span>
              {statusLabel && (
                <span className="text-xs text-secondary animate-pulse">{statusLabel}</span>
              )}
            </div>

            {sessionState === "completed" && response && (
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

          {/* Plan section */}
          <div className="px-4 py-3">
            {/* Plan header (clickable when collapsed) */}
            <button
              onClick={() => setIsPlanCollapsed((v) => !v)}
              className="flex items-center gap-2 text-xs font-medium text-secondary mb-2 hover:text-primary transition-colors"
            >
              <ChevronRight
                className={cn("size-3 transition-transform duration-200", !isPlanCollapsed && "rotate-90")}
              />
              <span>Plan</span>
              {isPlanCollapsed && (
                <span className="text-tertiary">
                  ({completedCount}/{planSteps.length} completed)
                </span>
              )}
            </button>

            {/* Plan steps */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                isPlanCollapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
              )}
            >
              <div className="space-y-1 ml-1 mb-3">
                {planSteps.map((step, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-2 py-0.5 transition-all duration-300",
                      step.status === "completed" && "opacity-60",
                      step.status === "pending" && "opacity-40"
                    )}
                  >
                    {step.status === "completed" ? (
                      <div className="flex items-center justify-center size-4">
                        <Check className="size-3.5 text-green-500 animate-in zoom-in-0 duration-200" />
                      </div>
                    ) : step.status === "active" ? (
                      <div className="flex items-center justify-center size-4">
                        <Loader2 className="size-3.5 text-primary animate-spin" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center size-4">
                        <Circle className="size-2.5 text-tertiary" />
                      </div>
                    )}
                    <span
                      className={cn(
                        "text-xs",
                        step.status === "active" ? "text-primary font-medium" : "text-secondary"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ephemeral thought */}
            {ephemeralThought && (isWorking || isResponding) && (
              <div className="flex items-start gap-2 py-2 border-t border-dashed border-primary/10">
                <Zap className="size-3 text-primary/50 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-secondary italic transition-opacity duration-200 line-clamp-2">
                  {ephemeralThought}
                </span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 py-2 text-sm text-danger-primary">
                <span>{error}</span>
                <button onClick={handleRetry} className="text-xs underline hover:no-underline">
                  Retry
                </button>
              </div>
            )}

            {/* Response body */}
            {response && (
              <div
                ref={containerRef}
                className={cn(
                  "mt-2 pt-3 border-t border-primary/10",
                  sessionState !== "completed" && "max-h-[300px] overflow-y-auto"
                )}
              >
                <div className="prose prose-sm max-w-none text-primary whitespace-pre-wrap text-sm">
                  {response}
                </div>
              </div>
            )}

            {/* Loading state before any content */}
            {sessionState === "calling" && !error && (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="size-3.5 text-primary animate-spin" />
                <span className="text-xs text-secondary">Connecting to ZenithAgent...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
