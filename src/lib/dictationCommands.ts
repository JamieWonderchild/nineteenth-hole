// Dictation command processor
// Parses finalized transcript segments and converts voice commands into formatted blocks.
// Supports: bullet lists, numbered lists, paragraph breaks, inline punctuation.
//
// Commands can appear ANYWHERE in a segment — not just at the start.

export type DictationMode = 'paragraph' | 'bullet' | 'numbered';

export interface DictationBlock {
  type: 'paragraph' | 'bullet' | 'numbered';
  text: string;
  number?: number;
}

export interface DictationState {
  blocks: DictationBlock[];
  pendingText: string;
  mode: DictationMode;
  numberedCounter: number;
}

export function createDictationState(): DictationState {
  return { blocks: [], pendingText: '', mode: 'paragraph', numberedCounter: 0 };
}

// ─── Split pattern — capture group keeps delimiters in result ────────────────
// Order matters: longer/more-specific phrases before shorter ones.

const CMD_SPLIT = /(start\s+numbered\s+list|start\s+bullet\s+list|numbered\s+list|bullet\s+list|bullet\s*point|list\s*item|new\s*bullet|next\s*bullet|next\s*point|next\s*number|next\s*item|numbered?\s*item|new\s*number|new\s*line|new\s*paragraph|end\s*list|paragraph\s*break)/gi;

// Inline punctuation substitutions
const PUNCTUATION: Array<[RegExp, string]> = [
  [/\bperiod\b/gi, '.'],
  [/\bfull\s*stop\b/gi, '.'],
  [/\bcomma\b/gi, ','],
  [/\bsemicolon\b/gi, ';'],
  [/\bcolon\b/gi, ':'],
  [/\bquestion\s*mark\b/gi, '?'],
  [/\bexclamation\s*(?:mark|point)\b/gi, '!'],
  [/\bhyphen\b/gi, '-'],
  [/\bopen\s*parenthes[ie]s\b/gi, '('],
  [/\bclose\s*parenthes[ie]s\b/gi, ')'],
];

function applyPunctuation(text: string): string {
  let t = text;
  for (const [pattern, replacement] of PUNCTUATION) {
    t = t.replace(pattern, replacement);
  }
  return t.replace(/\s+([.,;:?!)])/g, '$1').replace(/\(\s+/g, '(').trim();
}

function flushPending(state: DictationState): DictationState {
  const text = state.pendingText.trim();
  if (!text) return { ...state, pendingText: '' };
  return {
    ...state,
    blocks: [
      ...state.blocks,
      {
        type: state.mode,
        text,
        ...(state.mode === 'numbered' ? { number: state.numberedCounter } : {}),
      },
    ],
    pendingText: '',
  };
}

function applyCommand(cmd: string, s: DictationState): DictationState {
  const lower = cmd.toLowerCase().replace(/\s+/g, ' ').trim();

  if (/^(bullet point|list item|new bullet|next bullet|next point)$/.test(lower)) {
    return { ...s, mode: 'bullet' };
  }

  if (/^(next number|next item|new number)$/.test(lower) || /^numbered? item$/.test(lower)) {
    return {
      ...s,
      mode: 'numbered',
      numberedCounter: s.mode === 'numbered' ? s.numberedCounter + 1 : 1,
    };
  }

  if (/numbered list|start numbered/.test(lower)) {
    return { ...s, mode: 'numbered', numberedCounter: 1 };
  }

  if (/bullet list|start bullet/.test(lower)) {
    return { ...s, mode: 'bullet' };
  }

  // new line / new paragraph / end list / paragraph break
  if (s.mode === 'numbered') {
    return { ...s, numberedCounter: s.numberedCounter + 1 };
  }
  return { ...s, mode: 'paragraph' };
}

export function processSegment(raw: string, state: DictationState): DictationState {
  let s = { ...state };

  // Split on any command — capture group keeps the command tokens in the array
  const parts = raw.trim().split(CMD_SPLIT);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Re-test whether this part IS a command token
    CMD_SPLIT.lastIndex = 0;
    if (CMD_SPLIT.test(trimmed)) {
      // Flush whatever text was accumulating, then apply the command
      s = flushPending(s);
      s = applyCommand(trimmed, s);
    } else {
      // Regular speech — apply punctuation and append
      const clean = applyPunctuation(trimmed);
      if (clean) {
        s = { ...s, pendingText: [s.pendingText, clean].filter(Boolean).join(' ') };
      }
    }
  }

  return s;
}

export function finalizeState(state: DictationState): DictationState {
  return flushPending(state);
}

/** Convert state to markdown string for saving */
export function stateToMarkdown(state: DictationState): string {
  const fin = finalizeState(state);
  if (fin.blocks.length === 0) return fin.pendingText;
  return fin.blocks
    .map((b) => {
      if (b.type === 'bullet') return `- ${b.text}`;
      if (b.type === 'numbered') return `${b.number}. ${b.text}`;
      return b.text;
    })
    .join('\n');
}

/** Capitalize first letter of each block */
function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Render state as JSX-friendly data for the live preview */
export interface RenderedContent {
  blocks: DictationBlock[];
  pendingText: string;
  mode: DictationMode;
}

export function getRenderedContent(state: DictationState): RenderedContent {
  return {
    blocks: state.blocks.map((b) => ({ ...b, text: capitalize(b.text) })),
    pendingText: capitalize(state.pendingText),
    mode: state.mode,
  };
}
