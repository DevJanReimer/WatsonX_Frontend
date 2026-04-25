/**
 * Thin client for watsonx Orchestrate's REST API.
 *
 * Auth model: IBM Cloud IAM API key is exchanged for a short-lived bearer
 * token. We cache the token in-memory between requests until 60s before it
 * expires.
 *
 * Endpoints follow Orchestrate's OpenAI-compatible chat completions shape.
 * Adjust paths here if your instance uses a different route.
 */

interface IamToken {
  access_token: string;
  expires_at: number; // epoch seconds
}

let cached: IamToken | null = null;

async function fetchIamToken(): Promise<IamToken> {
  const apiKey = process.env.IBM_CLOUD_API_KEY;
  const tokenUrl =
    process.env.IAM_TOKEN_URL || "https://iam.cloud.ibm.com/identity/token";
  if (!apiKey) throw new Error("IBM_CLOUD_API_KEY is not set");

  console.log(`[orchestrate] fetching IAM token from ${tokenUrl}`);
  const body = new URLSearchParams({
    grant_type: "urn:ibm:params:oauth:grant-type:apikey",
    apikey: apiKey
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`[orchestrate] IAM token exchange failed: ${res.status} ${txt}`);
    throw new Error(`IAM token exchange failed: ${res.status} ${txt}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expiration: number; // epoch seconds
  };
  console.log(`[orchestrate] IAM token obtained, expires ${new Date(data.expiration * 1000).toISOString()}`);
  return { access_token: data.access_token, expires_at: data.expiration };
}

export async function getBearerToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expires_at - 60 > now) return cached.access_token;
  cached = await fetchIamToken();
  return cached.access_token;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  stream?: boolean;
}

function orchestrateBase(): string {
  const url = process.env.WXO_INSTANCE_URL;
  if (!url) throw new Error("WXO_INSTANCE_URL is not set");
  return url.replace(/\/$/, "");
}

function agentId(): string {
  const id = process.env.WXO_AGENT_ID;
  if (!id) throw new Error("WXO_AGENT_ID is not set");
  return id;
}

/**
 * Call Orchestrate's chat completion endpoint for the configured agent.
 * Returns the raw Response so callers can stream the body straight through.
 */
export async function orchestrateChat(
  opts: ChatOptions
): Promise<Response> {
  const token = await getBearerToken();

  const url = `${orchestrateBase()}/v1/orchestrate/${encodeURIComponent(
    agentId()
  )}/chat/completions`;

  return await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: opts.stream ? "text/event-stream" : "application/json"
    },
    body: JSON.stringify({
      messages: opts.messages,
      stream: !!opts.stream
    })
  });
}

/**
 * Upload a document to the agent's knowledge base. Requires
 * WXO_KNOWLEDGE_BASE_ID to be set.
 */
export async function orchestrateUpload(
  file: File
): Promise<{ status: number; body: unknown }> {
  const kbId = process.env.WXO_KNOWLEDGE_BASE_ID;
  if (!kbId) {
    return {
      status: 501,
      body: {
        error:
          "WXO_KNOWLEDGE_BASE_ID is not configured. Set it in the environment to enable document upload."
      }
    };
  }

  const token = await getBearerToken();
  const url = `${orchestrateBase()}/v1/orchestrate/knowledge_bases/${encodeURIComponent(
    kbId
  )}/documents`;

  console.log(`[orchestrate] uploading ${file.name} to ${url}`);
  const form = new FormData();
  form.append("file", file, file.name);

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  console.log(`[orchestrate] upload response for ${file.name}: ${res.status}`);

  let body: unknown;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    body = await res.json().catch(() => ({}));
  } else {
    body = await res.text();
  }
  return { status: res.status, body };
}
