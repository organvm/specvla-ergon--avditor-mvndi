import { generateText } from "ai";
import { createAIModel, type AIProvider } from "./aiModelFactory";
import { getCosmicAuditPrompt } from "./promptTemplates";
import { evaluateAudit } from "./evaluator";
import { scrapeWebsite } from "./scraper";
import { captureScreenshot } from "./vision";
import { getPageSpeedInsights } from "./pagespeed";

export interface OrchestratedAuditRequest {
  link: string;
  businessType: string;
  goals: string;
  provider: AIProvider;
  auth: string;
  isPro: boolean;
  scrapeDepth?: number;
  advancedAudit?: boolean;
  language?: string;
}

export interface OrchestratedAuditResponse {
  markdownAudit: string;
  scores: Record<string, number>;
  evaluationScore: number;
  iterations: number;
}

/**
 * THE SUBMERGED ORCHESTRATOR
 * Implements the Deep-Disclosure Covenant by handling 90% of the 
 * audit complexity beneath the API surface.
 */
export async function orchestrateCosmicAudit(
  data: OrchestratedAuditRequest
): Promise<OrchestratedAuditResponse> {
  const credential = data.auth; // allow-secret
  const isPro = data.isPro;
  const scrapeDepth = data.scrapeDepth ?? (isPro ? 3 : 1);
  const advancedAudit = data.advancedAudit ?? isPro;

  // 1. Submerged Context Gathering (Parallel)
  const [scrapedContent, screenshotBase64, seoData] = await Promise.all([
    scrapeWebsite(data.link, scrapeDepth),
    captureScreenshot(data.link).catch(() => null),
    getPageSpeedInsights(data.link).catch(() => null),
  ]);

  const model = createAIModel(data.provider, credential);
  const prompt = getCosmicAuditPrompt(data.link, data.businessType, data.goals, scrapedContent, seoData, data.language);

  // 2. Initial Generation
  const { text } = await generateText({
    model,
    messages: [{
      role: "user",
      content: [
        { type: "text" as const, text: prompt },
        ...(screenshotBase64 ? [{ type: "image" as const, image: screenshotBase64 }] : [])
      ],
    }],
  });

  let parsedResult = parseAIResponse(text);
  
  // 2.5 PROPRIETARY SCRUBBER
  // If user is not Pro, we scrub technical details and replace with "Alluded Depth"
  if (!advancedAudit) {
    parsedResult.markdownAudit = scrubProprietaryInfo(parsedResult.markdownAudit);
  }

  let iterations = 1;

  // 3. Latent Evaluation Loop (LLM-as-a-Judge)
  const evaluation = await evaluateAudit(parsedResult.markdownAudit, data.provider, credential);
  
  if (!evaluation.passed && iterations < 2) {
    const retryPrompt = `${prompt}\n\nREFINEMENT NEEDED: Previous attempt scored ${evaluation.score}/100. Feedback: ${evaluation.feedback}. Ensure absolute alignment with the Deep-Disclosure covenant.`;
    
    const retryResult = await generateText({
      model,
      messages: [{
        role: "user",
        content: [{ type: "text" as const, text: retryPrompt }],
      }],
    });

    parsedResult = parseAIResponse(retryResult.text);
    if (!advancedAudit) {
      parsedResult.markdownAudit = scrubProprietaryInfo(parsedResult.markdownAudit);
    }
    iterations++;
  }

  // Prepend the Disclosure Warning
  const disclosurePrefix = `> **PROPRIETARY DISCLOSURE:** This audit contains high-level strategic signals. Technical implementation specifics and deep-disclosure playbooks are gated behind the [Paths to Manifestation] below.\n\n`;
  parsedResult.markdownAudit = disclosurePrefix + parsedResult.markdownAudit;

  return {
    ...parsedResult,
    evaluationScore: evaluation.score,
    iterations,
  };
}

function parseAIResponse(text: string) {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1].trim() : text.trim();
    return JSON.parse(jsonText);
  } catch {
    console.error("Failed to parse submerged AI response:", text);
    throw new Error("Alignment failed: The stars returned malformed data.");
  }
}

/**
 * Ensures technical specifics are hidden for non-pro users.
 * Replaces direct "How-to" with "Strategic Allusions".
 */
function scrubProprietaryInfo(markdown: string): string {
  // Simple regex-based scrubbing for common technical 'how-tos'
  // In a real scenario, this would be a second AI pass
  return markdown
    .replace(/Change your (h1|h2|h3|title|meta) to "(.*?)"/gi, "Your $1 requires specific linguistic realignment [Gated]")
    .replace(/Add a (.*?) tag/gi, "A $1 structural element is missing [Disclosure Required]")
    .replace(/Fix your (.*?) by (.*?)\./gi, "Your $1 is misaligned; the fix is available in the Vault.")
    .replace(/You should (.*?) to improve (.*?)/gi, "Strategic $2 improvement is alluded to in the Vault.");
}
