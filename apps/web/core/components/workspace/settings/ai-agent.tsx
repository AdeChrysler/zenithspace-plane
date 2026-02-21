/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Input, CustomSelect } from "@plane/ui";
import { cn } from "@plane/utils";
// hooks
import { useUserPermissions } from "@/hooks/store/user";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
type TAgentMode = "disabled" | "comment_only" | "autonomous";

interface IAIAgentConfig {
  oauth_token: string;
  agent_mode: TAgentMode;
}

const ORCHESTRATOR_BASE_URL = "https://orchestrator.zenova.id";

const AGENT_MODE_OPTIONS: { value: TAgentMode; label: string; description: string }[] = [
  {
    value: "disabled",
    label: "Disabled",
    description: "AI Agent is turned off and will not respond to any events.",
  },
  {
    value: "comment_only",
    label: "Comment Only",
    description: "AI Agent will only post comments on issues. No autonomous actions.",
  },
  {
    value: "autonomous",
    label: "Autonomous",
    description: "AI Agent can create branches, write code, and open pull requests.",
  },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Mask all but the last 4 characters of a token string. */
function maskToken(token: string): string {
  if (token.length <= 4) return token;
  return "\u2022".repeat(token.length - 4) + token.slice(-4);
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const AIAgentSettings = observer(function AIAgentSettings() {
  // ---------------------------------------------------------------------------
  // Permission check
  // ---------------------------------------------------------------------------
  const { allowPermissions } = useUserPermissions();
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);

  // ---------------------------------------------------------------------------
  // Form state
  // ---------------------------------------------------------------------------
  const [oauthToken, setOauthToken] = useState("");
  const [oauthTokenMasked, setOauthTokenMasked] = useState("");
  const [agentMode, setAgentMode] = useState<TAgentMode>("disabled");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Connection status
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "checking">("disconnected");
  const [isTesting, setIsTesting] = useState(false);

  // Track whether the user has typed a new token (so we know to send it)
  const [tokenDirty, setTokenDirty] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch existing config on mount
  // ---------------------------------------------------------------------------
  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${ORCHESTRATOR_BASE_URL}/api/config`);
      if (!response.ok) throw new Error("Failed to fetch config");
      const data = (await response.json()) as IAIAgentConfig;

      setAgentMode(data.agent_mode ?? "disabled");

      // The API should never return the raw token; it returns a masked version.
      if (data.oauth_token) {
        setOauthTokenMasked(maskToken(data.oauth_token));
        setConnectionStatus("connected");
      } else {
        setOauthTokenMasked("");
        setConnectionStatus("disconnected");
      }
    } catch {
      // If the orchestrator is unreachable we just start with defaults.
      setConnectionStatus("disconnected");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  // ---------------------------------------------------------------------------
  // Save config
  // ---------------------------------------------------------------------------
  const handleSave = async () => {
    setIsSaving(true);

    const payload: Record<string, string> = {
      agent_mode: agentMode,
    };

    // Only send the token when the user has explicitly changed it.
    if (tokenDirty && oauthToken.length > 0) {
      payload.oauth_token = oauthToken;
    }

    try {
      const response = await fetch(`${ORCHESTRATOR_BASE_URL}/api/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to save config");

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success!",
        message: "AI Agent configuration saved successfully.",
      });

      // After saving, re-fetch so the masked token is up-to-date.
      setTokenDirty(false);
      setOauthToken("");
      await fetchConfig();
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Failed to save AI Agent configuration. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Test connection / health-check
  // ---------------------------------------------------------------------------
  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus("checking");

    try {
      const response = await fetch(`${ORCHESTRATOR_BASE_URL}/health`, {
        method: "GET",
      });

      if (response.ok) {
        setConnectionStatus("connected");
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "Connection successful",
          message: "The orchestrator at orchestrator.zenova.id is reachable.",
        });
      } else {
        throw new Error("Health check failed");
      }
    } catch {
      setConnectionStatus("disconnected");
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Connection failed",
        message: "Unable to reach the orchestrator. Check your network and try again.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-body-sm-regular text-tertiary">Loading AI Agent settings...</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full flex flex-col gap-y-8", { "opacity-60": !isAdmin })}>
      {/* ------------------------------------------------------------------ */}
      {/* Section heading                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-1">
        <h3 className="text-h5-semibold">AI Agent</h3>
        <p className="text-body-sm-regular text-tertiary">
          Configure the ZenithSpace AI Agent that can triage issues, write code, and open pull requests on your behalf.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Connection Status                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <h4 className="text-body-sm-medium text-tertiary">Connection Status</h4>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2">
            <span
              className={cn("inline-block size-2.5 rounded-full", {
                "bg-green-500": connectionStatus === "connected",
                "bg-red-500": connectionStatus === "disconnected",
                "bg-yellow-500 animate-pulse": connectionStatus === "checking",
              })}
            />
            <span className="text-body-sm-regular">
              {connectionStatus === "connected" && "Connected to orchestrator"}
              {connectionStatus === "disconnected" && "Disconnected"}
              {connectionStatus === "checking" && "Checking connection..."}
            </span>
          </span>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => void handleTestConnection()}
            loading={isTesting}
            disabled={!isAdmin || isTesting}
          >
            {isTesting ? "Testing..." : "Test Connection"}
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* OAuth Token Input                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <h4 className="text-body-sm-medium text-tertiary">Claude API / OAuth Token</h4>
        <p className="text-caption-sm-regular text-tertiary">
          Provide the API token used to authenticate with the Claude API. The token is stored encrypted on the
          orchestrator.
        </p>
        <div className="flex items-center gap-3">
          <div className="w-full max-w-md">
            <Input
              id="oauth-token"
              name="oauth_token"
              type="password"
              value={tokenDirty ? oauthToken : oauthTokenMasked}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                if (!tokenDirty) setTokenDirty(true);
                setOauthToken(e.target.value);
              }}
              placeholder="sk-ant-..."
              className="w-full rounded-md"
              disabled={!isAdmin}
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Agent Mode Selector                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-2">
        <h4 className="text-body-sm-medium text-tertiary">Agent Mode</h4>
        <p className="text-caption-sm-regular text-tertiary">
          Choose how the AI Agent interacts with your workspace.
        </p>
        <div className="w-full max-w-md">
          <CustomSelect
            value={agentMode}
            onChange={(val: TAgentMode) => setAgentMode(val)}
            label={AGENT_MODE_OPTIONS.find((o) => o.value === agentMode)?.label ?? "Select a mode"}
            buttonClassName="border border-subtle bg-layer-2 !shadow-none !rounded-md"
            input
            disabled={!isAdmin}
          >
            {AGENT_MODE_OPTIONS.map((option) => (
              <CustomSelect.Option key={option.value} value={option.value}>
                <div className="flex flex-col">
                  <span className="text-body-sm-medium">{option.label}</span>
                  <span className="text-caption-sm-regular text-tertiary">{option.description}</span>
                </div>
              </CustomSelect.Option>
            ))}
          </CustomSelect>
        </div>

        {/* Inline radio-style display for quick visual scanning */}
        <div className="mt-2 flex flex-col gap-3">
          {AGENT_MODE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                agentMode === option.value
                  ? "border-accent-primary bg-accent-primary/5"
                  : "border-subtle bg-layer-2 hover:bg-layer-2-hover",
                { "pointer-events-none": !isAdmin }
              )}
            >
              <input
                type="radio"
                name="agent_mode"
                value={option.value}
                checked={agentMode === option.value}
                onChange={() => setAgentMode(option.value)}
                className="mt-0.5 size-4 accent-accent-primary"
                disabled={!isAdmin}
              />
              <div className="flex flex-col">
                <span className="text-body-sm-medium">{option.label}</span>
                <span className="text-caption-sm-regular text-tertiary">{option.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Save Button                                                         */}
      {/* ------------------------------------------------------------------ */}
      {isAdmin && (
        <div className="flex items-center justify-between py-2">
          <Button
            variant="primary"
            size="lg"
            onClick={() => void handleSave()}
            loading={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
});
