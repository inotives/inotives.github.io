// Captures real model answers for the AI SDK chat fixtures mock (public/mocks/shadcn-ai-sdk-chat.html).
//
//   node scripts/mocks/shadcn-ai-sdk-chat/capture.mjs
//
// Sends each prompt below to Claude Sonnet 5.5 five times through the Claude Code CLI (claude -p) with a
// short custom system prompt, no tools and no MCP servers, and records time to first token, total time,
// tokens, cost and the answer text. The mock replays these answers through @shadcn/helpers/ai-sdk, and
// shows the timing and cost numbers next to the scripted runs. Needs a logged-in `claude` on PATH.
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = new URL('../../../', import.meta.url);
const out = new URL('public/mocks/data/shadcn-ai-sdk-chat.json', root);
const MODEL = 'claude-sonnet-5-5';
const RUNS = 5;
const SYSTEM = "You are the assistant inside a crypto trading app's chat panel. Answer the user's question about crypto markets concisely. You have no live data or tools; if you would need live data, say what you would fetch and give a plausible illustrative answer clearly marked as illustrative.";
const PROMPTS = {
  "quote": "What's the SOL price right now, and why did it move today?",
  "trade": "Buy 2 SOL at market for me.",
  "compare": "Compare SOL, ETH and BTC on fees, speed and ecosystem. Use a table.",
  "explain": "Explain what funding rates on perps tell me, in a few sentences."
};

// A clean environment: no settings from a parent Claude Code session
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE') && k !== 'AI_AGENT'));

async function ask(prompt) {
  const { stdout } = await run('claude', ['-p', prompt, '--model', MODEL, '--system-prompt', SYSTEM, '--tools', '',
    '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence', '--output-format', 'json'], { env, maxBuffer: 1 << 24 });
  const j = JSON.parse(stdout.trim().split('\n').at(-1));
  if (j.is_error) throw new Error(j.result);
  const u = j.usage;
  return { ttftMs: j.ttft_ms, totalMs: j.duration_ms, inputTokens: u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens,
    outputTokens: u.output_tokens, costUsd: j.total_cost_usd, chars: j.result.length, text: j.result };
}

const data = { capturedAt: new Date().toISOString().slice(0, 10), model: MODEL,
  how: `claude -p with a custom system prompt, no tools, no MCP servers, ${RUNS} runs per prompt (scripts/mocks/shadcn-ai-sdk-chat/capture.mjs)`,
  pricing: 'USD at Anthropic list prices, as reported by Claude Code (total_cost_usd)', systemPrompt: SYSTEM, prompts: {} };
for (const [key, prompt] of Object.entries(PROMPTS)) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) { runs.push(await ask(prompt)); process.stdout.write(`\r${key} ${i + 1}/${RUNS}`); }
  data.prompts[key] = { prompt, runs };
  process.stdout.write('\n');
}
await writeFile(out, JSON.stringify(data));
console.log(`wrote ${out.pathname.replace(root.pathname, '')}`);
