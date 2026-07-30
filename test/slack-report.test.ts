import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  buildBlocks,
  createTriageReportTool,
  formatReport,
} from '../src/tools/slack-report.ts';

const report = {
  riskLevel: 'critical' as const,
  summary: 'Attributed C2 beacon from a corporate device',
  keyFindings: ['Salt Typhoon C2 match', 'Login from new country'],
  accessEvent: 'alice@corp.com allowed to app.corp.com from RU',
  gatewayActivity: 'DNS query to malware-c2-domain.ru blocked',
  postureStatus: 'MacBook, macOS 14.5, last seen 2h ago',
  threatIntelHits: ['malware-c2-domain.ru — Salt Typhoon (C2)'],
  recommendedAction: 'Isolate the device & rotate credentials',
};

describe('formatReport', () => {
  test('includes the uppercased risk level and findings', () => {
    const text = formatReport(report);
    expect(text).toContain('risk: CRITICAL');
    expect(text).toContain('Salt Typhoon C2 match');
  });
  test('renders "(none)" for empty lists', () => {
    const text = formatReport({ ...report, threatIntelHits: [] });
    expect(text).toContain('(none)');
  });
});

describe('buildBlocks', () => {
  test('header carries the risk emoji and level', () => {
    const blocks = buildBlocks(report) as Array<Record<string, any>>;
    expect(blocks[0].type).toBe('header');
    expect(blocks[0].text.text).toContain('CRITICAL');
    expect(blocks[0].text.text).toContain('\u{1F534}'); // red
  });
  test('exposes the three context fields', () => {
    const blocks = buildBlocks(report) as Array<Record<string, any>>;
    const fieldBlock = blocks.find((b) => Array.isArray(b.fields));
    expect(fieldBlock?.fields).toHaveLength(3);
  });
  test('escapes mrkdwn control characters', () => {
    const blocks = buildBlocks({ ...report, summary: 'a < b & c > d' }) as Array<
      Record<string, any>
    >;
    const summaryBlock = blocks.find((b) => b.text?.text?.includes('Summary'));
    expect(summaryBlock?.text.text).toContain('&lt;');
    expect(summaryBlock?.text.text).toContain('&amp;');
    expect(summaryBlock?.text.text).toContain('&gt;');
  });
});

// Minimal ToolContext stand-in for a durable tool: `step.do` runs the work
// inline (no interruption), and `log` is a no-op sink.
function runCtx(data: typeof report) {
  return {
    data,
    step: { do: <T,>(_name: string, fn: () => T | Promise<T>) => Promise.resolve(fn()) },
    log: { info() {}, warn() {}, error() {} },
  } as never;
}

describe('createTriageReportTool delivery', () => {
  const SLACK_VARS = ['SLACK_BOT_TOKEN'];
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = {};
    for (const key of SLACK_VARS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });
  afterEach(() => {
    for (const key of SLACK_VARS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  test('no Slack thread -> delivered to run output', async () => {
    const tool = createTriageReportTool();
    const result = (await tool.run(runCtx(report))) as {
      delivered: string;
      riskLevel: string;
    };
    expect(result.delivered).toBe('run-output');
    expect(result.riskLevel).toBe('critical');
  });

  test('Slack thread but no bot token -> delivered:"failed" (never a false success)', async () => {
    const tool = createTriageReportTool({ channelId: 'C123', threadTs: '111.222' } as never);
    const result = (await tool.run(runCtx(report))) as {
      delivered: string;
      error?: string;
    };
    expect(result.delivered).toBe('failed');
    expect(result.error).toMatch(/SLACK_BOT_TOKEN/);
  });
});
