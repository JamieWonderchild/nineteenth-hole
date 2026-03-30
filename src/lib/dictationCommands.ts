// Dictation command processor
// Parses finalized transcript segments and converts voice commands into formatted blocks.
// Supports: bullet lists, numbered lists, paragraph breaks, inline punctuation.

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

// Commands that start a new block
const BULLET_CMD = /^[\s,.]*(bullet\s*point|list\s*item|new\s*bullet|next\s*bullet|next\s*point)\b\s*/i;
const NUMBERED_CMD = /^[\s,.]*(next\s*number|next\s*item|numbered?\s*item|new\s*number)\b\s*/i;
const NEW_LIST_CMD = /^[\s,.]*(start\s*(numbered|bullet)\s*list|numbered\s*list|bullet\s*list)\b\s*/i;

// Commands that break the current block mid-sentence
const BREAK_CMD = /\b(new\s*line|new\s*paragraph|end\s*list|paragraph\s*break)\b/gi;

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
  // Clean up spaces before punctuation
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

export function processSegment(raw: string, state: DictationState): DictationState {
  let text = raw.trim();
  let s = { ...state };

  // Detect block-starting command at the beginning of the segment
  if (BULLET_CMD.test(text)) {
    s = flushPending(s);
    text = text.replace(BULLET_CMD, '').trim();
    s = { ...s, mode: 'bullet' };
  } else if (NUMBERED_CMD.test(text)) {
    s = flushPending(s);
    text = text.replace(NUMBERED_CMD, '').trim();
    s = {
      ...s,
      mode: 'numbered',
      numberedCounter: s.mode === 'numbered' ? s.numberedCounter + 1 : 1,
    };
  } else if (NEW_LIST_CMD.test(text)) {
    s = flushPending(s);
    const isNumbered = /numbered/.test(text.toLowerCase());
    text = text.replace(NEW_LIST_CMD, '').trim();
    s = { ...s, mode: isNumbered ? 'numbered' : 'bullet', numberedCounter: isNumbered ? 1 : 0 };
  }

  // Handle break commands mid-segment (split into sub-parts)
  BREAK_CMD.lastIndex = 0;
  if (BREAK_CMD.test(text)) {
    BREAK_CMD.lastIndex = 0;
    const parts = text.split(BREAK_CMD);
    for (let i = 0; i < parts.length; i++) {
      const part = applyPunctuation(parts[i].trim());
      // Skip the command word itself (captured by the split group)
      if (!part || /^(new\s*line|new\s*paragraph|end\s*list|paragraph\s*break)$/i.test(part)) {
        if (i < parts.length - 1) {
          s = flushPending(s);
          if (s.mode === 'numbered') s = { ...s, numberedCounter: s.numberedCounter + 1 };
          else s = { ...s, mode: 'paragraph' };
        }
        continue;
      }
      s = { ...s, pendingText: [s.pendingText, part].filter(Boolean).join(' ') };
    }
  } else {
    const clean = applyPunctuation(text);
    if (clean) {
      s = { ...s, pendingText: [s.pendingText, clean].filter(Boolean).join(' ') };
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
