import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  cloudforceOneEnabled,
  getCloudflareApiConfig,
  getCloudforceOneConfig,
  getModel,
  getSlackConfig,
  InvalidConfigError,
  MissingConfigError,
} from '../src/lib/config.ts';

// Config reads process.env at call time, so each test mutates a clean copy.
const CONFIG_VARS = [
  'MODEL',
  'CF_API_TOKEN',
  'CF_ACCOUNT_ID',
  'CLOUDFORCE_ONE_API_TOKEN',
  'CF_CLOUDFORCE_ONE_DATASET',
  'SLACK_SIGNING_SECRET',
  'SLACK_BOT_TOKEN',
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of CONFIG_VARS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of CONFIG_VARS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('getModel', () => {
  test('defaults to openai/gpt-4o', () => {
    expect(getModel()).toBe('openai/gpt-4o');
  });
  test('accepts provider/model form', () => {
    process.env.MODEL = 'cloudflare/openai/gpt-4o';
    expect(getModel()).toBe('cloudflare/openai/gpt-4o');
  });
  test('rejects malformed model specifier', () => {
    process.env.MODEL = 'not-a-valid-model';
    expect(() => getModel()).toThrow(InvalidConfigError);
  });
});

describe('getCloudflareApiConfig', () => {
  test('throws MissingConfigError listing every missing var', () => {
    try {
      getCloudflareApiConfig();
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MissingConfigError);
      expect((err as MissingConfigError).vars).toEqual(['CF_API_TOKEN', 'CF_ACCOUNT_ID']);
    }
  });
  test('treats whitespace-only values as unset', () => {
    process.env.CF_API_TOKEN = '   ';
    process.env.CF_ACCOUNT_ID = 'acct123';
    expect(() => getCloudflareApiConfig()).toThrow(MissingConfigError);
  });
  test('returns config when both present', () => {
    process.env.CF_API_TOKEN = 'tok';
    process.env.CF_ACCOUNT_ID = 'acct123';
    expect(getCloudflareApiConfig()).toEqual({ apiToken: 'tok', accountId: 'acct123' });
  });
});

describe('getCloudforceOneConfig (optional)', () => {
  test('returns null when the token is unset', () => {
    expect(getCloudforceOneConfig()).toBeNull();
  });
  test('throws when token is set but account id is missing', () => {
    process.env.CLOUDFORCE_ONE_API_TOKEN = 'cf1-token';
    expect(() => getCloudforceOneConfig()).toThrow(MissingConfigError);
  });
  test('defaults dataset to "all"', () => {
    process.env.CLOUDFORCE_ONE_API_TOKEN = 'cf1-token';
    process.env.CF_ACCOUNT_ID = 'acct123';
    expect(getCloudforceOneConfig()).toEqual({
      apiToken: 'cf1-token',
      accountId: 'acct123',
      dataset: 'all',
    });
  });
  test('honors a dataset override', () => {
    process.env.CLOUDFORCE_ONE_API_TOKEN = 'cf1-token';
    process.env.CF_ACCOUNT_ID = 'acct123';
    process.env.CF_CLOUDFORCE_ONE_DATASET = 'my-dataset';
    expect(getCloudforceOneConfig()?.dataset).toBe('my-dataset');
  });
});

describe('cloudforceOneEnabled', () => {
  test('false when the token is absent', () => {
    expect(cloudforceOneEnabled()).toBe(false);
  });
  test('true when the token is present', () => {
    process.env.CLOUDFORCE_ONE_API_TOKEN = 'cf1-token';
    expect(cloudforceOneEnabled()).toBe(true);
  });
});

describe('getSlackConfig (fail closed)', () => {
  test('signingSecret is empty string when unset, botToken undefined', () => {
    expect(getSlackConfig()).toEqual({ signingSecret: '', botToken: undefined });
  });
  test('passes through configured values', () => {
    process.env.SLACK_SIGNING_SECRET = 'sekret';
    process.env.SLACK_BOT_TOKEN = 'xoxb-1';
    expect(getSlackConfig()).toEqual({ signingSecret: 'sekret', botToken: 'xoxb-1' });
  });
});
