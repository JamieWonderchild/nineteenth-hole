// Docs Search Service
// AI-powered search over [PRODUCT_NAME] documentation using Corti ephemeral agents.
// Follows the same polling pattern as case-reasoning-chat.ts.

import { getCortiAgentClient } from '@/services/corti-agents';
import type { CreateCortiAgentRequest } from '@/types/corti';
import { extractTaskText } from '@/types/corti';
import { getAllDocsContent, getArticleBySlug, getAllSlugs } from '@/content/docs';

// ============================================================================
// TYPES
// ============================================================================

export interface DocsSearchOptions {
  agentId?: string;
  contextId?: string;
}

export interface DocsSearchResult {
  message: string;
  agentId?: string;
  contextId?: string;
  suggestedSlugs?: string[];
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

function buildDocsSystemPrompt(): string {
  const allContent = getAllDocsContent();

  return `You are the [PRODUCT_NAME] product assistant. You help physicians and clinic staff understand how to use [PRODUCT_NAME].

## Your Role

Answer questions about [PRODUCT_NAME] features, workflows, and settings. Be concise and practical. When an article directly covers the answer, cite it by name. Focus only on [PRODUCT_NAME] — politely redirect off-topic questions.

## Response Style

- Keep answers short and actionable (2-4 sentences for simple questions, up to 3-4 bullet points for complex ones)
- Use markdown formatting (bold, bullets) for clarity
- If unsure, say so — don't hallucinate features that aren't in the docs
- Always answer from the documentation below, not general knowledge about other products

## Suggesting Articles

When your answer is covered by a specific article, end your response with a line in this exact format (article slug only, comma-separated if multiple):
ARTICLES: slug1, slug2

Available slugs: ${getAllSlugs().join(', ')}

---

## [PRODUCT_NAME] Documentation

${allContent}`;
}

// ============================================================================
// AGENT CREATION
// ============================================================================

interface DocsAgentIds {
  agentId: string;
  contextId: string | undefined;
  isNew: boolean;
}

async function getOrCreateDocsAgent(options: DocsSearchOptions): Promise<DocsAgentIds> {
  if (options.agentId) {
    console.log('[DocsSearch] ♻️ Reusing existing agent:', options.agentId);
    return {
      agentId: options.agentId,
      contextId: options.contextId,
      isNew: false,
    };
  }

  console.log('[DocsSearch] 🆕 Creating new docs agent');

  const client = getCortiAgentClient();
  const systemPrompt = buildDocsSystemPrompt();

  console.log('[DocsSearch] System prompt length:', systemPrompt.length, 'chars');

  const request: CreateCortiAgentRequest = {
    name: `docs-assistant-${Date.now().toString(36)}`,
    description: '[PRODUCT_NAME] product documentation assistant',
    systemPrompt,
    experts: [],
  };

  const agent = await client.createAgent(request, true);
  console.log('[DocsSearch] ✅ Agent created:', agent.id);

  return {
    agentId: agent.id,
    contextId: undefined,
    isNew: true,
  };
}

// ============================================================================
// SEARCH
// ============================================================================

export async function searchDocs(
  query: string,
  options: DocsSearchOptions = {}
): Promise<DocsSearchResult> {
  console.log('[DocsSearch] ⏱️ REQUEST START');
  console.log('[DocsSearch] Query:', query.slice(0, 100));
  console.log('[DocsSearch] Agent reuse:', options.agentId ? 'YES' : 'NO');

  const client = getCortiAgentClient();
  const agentIds = await getOrCreateDocsAgent(options);

  let task;
  try {
    task = await client.sendTextMessage(agentIds.agentId, query, agentIds.contextId);
  } catch (error) {
    console.error('[DocsSearch] ❌ sendTextMessage failed:', error instanceof Error ? error.message : error);
    throw error;
  }

  console.log('[DocsSearch] Task ID:', task.id, '| initial state:', task.status?.state);

  // Poll for completion (same pattern as case-reasoning-chat.ts)
  const maxAttempts = 175; // 35s at 200ms
  const pollInterval = 200;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const state = task.status?.state;

    if (state === 'completed') {
      console.log('[DocsSearch] ✅ Task completed after', attempts, 'polls');
      break;
    }

    if (state === 'failed') {
      console.error('[DocsSearch] ❌ Task failed:', task.status?.message);
      break;
    }

    if (state === 'pending' || state === 'running') {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      try {
        task = await client.getTask(agentIds.agentId, task.id);
      } catch (error) {
        console.error('[DocsSearch] ❌ Error polling at attempt', attempts, ':', error);
        break;
      }
    } else {
      console.warn('[DocsSearch] ⚠️ Unknown state:', state);
      break;
    }
  }

  if (attempts >= maxAttempts) {
    console.error('[DocsSearch] ⏱️ Polling timeout after', attempts, 'attempts');
  }

  const rawText =
    extractTaskText(task) ||
    client.extractTextFromTask(task) ||
    'I could not find an answer. Please try rephrasing your question.';

  // Extract ARTICLES: line from response
  const articlesMatch = rawText.match(/ARTICLES:\s*([^\n]+)/i);
  let cleanMessage = rawText.replace(/ARTICLES:\s*[^\n]+/i, '').trim();
  let suggestedSlugs: string[] | undefined;

  if (articlesMatch) {
    const slugs = articlesMatch[1]
      .split(',')
      .map(s => s.trim())
      .filter(s => getAllSlugs().includes(s));
    if (slugs.length > 0) {
      suggestedSlugs = slugs;
    }
  }

  const responseContextId = task.contextId || agentIds.contextId;

  console.log('[DocsSearch] Message length:', cleanMessage.length, 'chars');
  console.log('[DocsSearch] Suggested slugs:', suggestedSlugs);

  return {
    message: cleanMessage,
    agentId: agentIds.isNew ? agentIds.agentId : undefined,
    contextId: agentIds.isNew ? responseContextId : undefined,
    suggestedSlugs,
  };
}
