import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerateText = vi.fn().mockResolvedValue({
  text: JSON.stringify({
    markdownAudit: 'Mocked audit response',
    scores: { communication: 90, aesthetic: 80, drive: 70, structure: 85 },
  }),
});

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

vi.mock('@/services/aiModelFactory', () => ({
  createAIModel: vi.fn().mockReturnValue('mock-model'),
}));

vi.mock('@/services/scraper', () => ({
  scrapeWebsite: vi.fn().mockResolvedValue("Mocked scraped content"),
}));

vi.mock('@/services/vision', () => ({
  captureScreenshot: vi.fn().mockResolvedValue('base64mockscreenshot'),
}));

vi.mock('@/services/pagespeed', () => ({
  getPageSpeedInsights: vi.fn().mockResolvedValue({
    performanceScore: 85,
    seoScore: 90,
    accessibilityScore: 78,
    bestPracticesScore: 88,
    lcp: '2.4s',
  }),
}));

vi.mock('@/lib/db', () => ({
  saveAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: 'test@example.com', name: 'Test User' } }),
}));

vi.mock('@/services/evaluator', () => ({
  evaluateAudit: vi.fn().mockResolvedValue({ score: 90, feedback: "Good", passed: true }),
}));

vi.mock('@/services/aiOrchestrator', () => ({
  orchestrateCosmicAudit: vi.fn().mockResolvedValue({
    markdownAudit: 'Mocked audit response',
    scores: { communication: 90 },
    evaluationScore: 90,
    iterations: 1
  }),
}));

import { POST } from './route';
import { auth } from '@/auth';
import { orchestrateCosmicAudit } from '@/services/aiOrchestrator';

describe('API Route /api/audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if Authorization header is missing', async () => {
    const request = new Request('http://localhost/api/audit', {
      method: 'POST',
      body: JSON.stringify({
        link: 'https://test.com',
        businessType: 'test',
        goals: 'test goals',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toContain('Missing Authorization');
  });

  it('returns 400 if required fields are missing', async () => {
    const request = new Request('http://localhost/api/audit', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-key', // allow-secret
      },
      body: JSON.stringify({
        link: 'https://test.com',
        // Missing businessType and goals
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid alignment data');
  });

  it('returns 429 after 5 requests from the same IP', async () => {
    const makeRequest = () => new Request('http://localhost/api/audit', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-key', // allow-secret
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.1.100',
      },
      body: JSON.stringify({
        link: 'https://test.com',
        businessType: 'SaaS',
        goals: 'Increase conversion',
      }),
    });

    // Make 5 requests (all should succeed)
    for (let i = 0; i < 5; i++) {
      const response = await POST(makeRequest());
      expect(response.status).toBe(200);
    }

    // 6th request should be rate limited
    const response = await POST(makeRequest());
    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toContain('Rate limit exceeded');
  });

  it('returns an audit if valid request is made with Authorization header', async () => {
    const request = new Request('http://localhost/api/audit', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-key', // allow-secret
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        link: 'https://test.com',
        businessType: 'SaaS',
        goals: 'Increase conversion',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.audit).toBe('Mocked audit response');
  });

  it('passes premium entitlements into the audit orchestrator', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        email: 'premium@example.com',
        plan: 'premium',
        isPremium: true,
        isPro: true,
      },
      expires: '',
    });

    const request = new Request('http://localhost/api/audit', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer valid-key', // allow-secret
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.1.101',
      },
      body: JSON.stringify({
        link: 'https://test.com',
        businessType: 'SaaS',
        goals: 'Increase conversion',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(orchestrateCosmicAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        advancedAudit: true,
        isPro: true,
        scrapeDepth: 5,
      })
    );
  });
});
