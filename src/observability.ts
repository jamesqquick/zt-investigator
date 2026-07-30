import { observe, type FlueEvent } from '@flue/runtime';

// Activity logging for `flue run`.
//
// The default CLI renderer only prints top-level `tool task` lines, so a run
// that delegates to subagents gives no insight into what actually happened.
// This observer subscribes to the event stream and prints the subagent
// delegations and tool calls (with arguments) that drive the investigation.
//
// Enabled by importing this module for its side effect. Set FLUE_QUIET=true
// to silence it.

function stringify(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value ?? '');
}

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Redact PII before it reaches the activity log. Investigation args and prompts
 * carry user emails, source IPs, and device IDs; logs should not. Masking is
 * partial where it preserves triage usefulness (domain kept, IP network hint
 * kept) and full where it does not.
 */
export function redact(text: string): string {
  return (
    text
      // email: keep first char of local part + full domain -> j***@corp.com
      .replace(/\b([A-Za-z0-9])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g, '$1***$2')
      // UUID / WARP device id -> keep first 8 chars
      .replace(/\b([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '$1…')
      // long opaque hex ids (32+ hex chars) -> keep first 8
      .replace(/\b([0-9a-f]{8})[0-9a-f]{24,}\b/gi, '$1…')
      // IPv6 (compressed "::" form) -> fully masked
      .replace(/\b[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*::[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*\b/gi, '[ipv6]')
      // IPv6 (full form, 6+ groups) -> masked. Requires many colon groups so a
      // plain HH:MM:SS timestamp (only two colons) is never touched.
      .replace(/\b(?:[0-9a-f]{1,4}:){5,}[0-9a-f]{1,4}\b/gi, '[ipv6]')
      // IPv4 -> keep network hint, mask host -> 203.0.x.x
      .replace(/\b(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}\b/g, '$1.$2.x.x')
  );
}

/** Stringify -> redact -> truncate, for any user-supplied value in the log. */
function safe(value: unknown, max = 120): string {
  return truncate(redact(stringify(value)), max);
}

function line(event: FlueEvent): string | undefined {
  // Indent activity that happens inside a subagent.
  const indent = event.taskId ? '    ' : '  ';
  switch (event.type) {
    case 'task_start':
      return `${indent}→ subagent ${event.agent} ${safe(event.prompt, 70)}`;
    case 'task':
      return `${indent}← subagent ${event.agent} ${event.isError ? 'error' : 'ok'} (${event.durationMs}ms)`;
    // The delegation tool is itself named "task"; task_start/task cover it.
    case 'tool_start':
      return event.toolName === 'task' ? undefined : `${indent}→ ${event.toolName} ${safe(event.args)}`;
    case 'tool':
      return event.toolName === 'task' ? undefined : `${indent}← ${event.toolName} ${event.isError ? 'error' : 'ok'} (${event.durationMs}ms)`;
    default:
      return undefined;
  }
}

if (process.env.FLUE_QUIET !== 'true') {
  observe((event) => {
    const rendered = line(event);
    if (rendered) process.stderr.write(`${rendered}\n`);
  });
}
