export function decodeHtmlEntities(text: string) {
  if (!text) return text;
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export function normalizeInlineCodeFences(text: string) {
  if (!text || typeof text !== 'string') return text;
  try {
    return text.replace(/```\s*([^\n\r]+?)\s*```/g, '`$1`');
  } catch {
    return text;
  }
}

export function unescapeWithMathProtection(text: string) {
  if (!text || typeof text !== 'string') return text;

  const mathBlocks: string[] = [];
  const placeholderPrefix = '__MATH_BLOCK_';
  const placeholderSuffix = '__';

  let processedText = text.replace(/\$\$([\s\S]*?)\$\$|\$([^\$\n]+?)\$/g, (match) => {
    const index = mathBlocks.length;
    mathBlocks.push(match);
    return `${placeholderPrefix}${index}${placeholderSuffix}`;
  });

  processedText = processedText.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r');

  processedText = processedText.replace(
    new RegExp(`${placeholderPrefix}(\\d+)${placeholderSuffix}`, 'g'),
    (match, index) => {
      return mathBlocks[parseInt(index, 10)];
    },
  );

  return processedText;
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatFileTreeInContent(text: string): string {
  if (!text || typeof text !== 'string') return text;

  // Pattern to detect file tree structures
  // Matches lines starting with ├──, └──, │, or multiple spaces followed by these symbols
  // Also matches the root directory line which often precedes the tree
  const lines = text.split('\n');
  const result: string[] = [];
  let isInTree = false;
  let treeLines: string[] = [];

  const isTreeLine = (line: string) => {
    const trimmed = line.trim();
    return (
      trimmed.startsWith('├──') ||
      trimmed.startsWith('└──') ||
      trimmed.startsWith('│') ||
      (trimmed.includes('──') && (trimmed.includes('├') || trimmed.includes('└')))
    );
  };

  const isPossibleRootLine = (line: string) => {
    const trimmed = line.trim();
    // Common root patterns: "dir/", "./dir", "/path/to/dir"
    return (
      trimmed.endsWith('/') ||
      trimmed.startsWith('./') ||
      trimmed.startsWith('/') ||
      (trimmed.length > 0 && !trimmed.includes(' ') && trimmed.includes('/'))
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];

    if (isTreeLine(line)) {
      if (!isInTree) {
        // Look back one line to see if it's the root directory
        if (result.length > 0 && isPossibleRootLine(result[result.length - 1])) {
          const rootLine = result.pop()!;
          isInTree = true;
          treeLines = [rootLine, line];
        } else {
          isInTree = true;
          treeLines = [line];
        }
      } else {
        treeLines.push(line);
      }
    } else if (isInTree) {
      // Sometimes there are empty lines or lines with just vertical bars in a tree
      if (line.trim() === '' || line.trim() === '│') {
        treeLines.push(line);
      } else {
        // End of tree
        result.push('```text\n' + treeLines.join('\n') + '\n```');
        result.push(line);
        isInTree = false;
        treeLines = [];
      }
    } else {
      result.push(line);
    }
  }

  // Handle case where tree ends at the last line
  if (isInTree) {
    result.push('```text\n' + treeLines.join('\n') + '\n```');
  }

  return result.join('\n');
}

export function formatUsageLimitText(text: string) {
  try {
    if (typeof text !== 'string') return text;
    
    // First apply file tree formatting
    let formattedText = formatFileTreeInContent(text);

    // Strip <thinking>...</thinking> blocks that appear inline in assistant messages
    formattedText = formattedText.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, '');

    return formattedText.replace(/Claude AI usage limit reached\|\d{10,13}/g, 'AI usage limit reached. Please try again later.');    
  } catch {
    return text;
  }
}

// Re-export from shared module — single source of truth for both server and client
import { splitLegacyGeminiThoughtContent } from '../../../../shared/geminiThoughtParser.js';
export { splitLegacyGeminiThoughtContent };

export function buildAssistantMessages(
  content: string,
  timestamp: Date | string | number,
): Array<{ type: string; content: string; timestamp: Date | string | number; isThinking?: boolean }> {
  const legacySegments = splitLegacyGeminiThoughtContent(content);
  if (legacySegments) {
    return legacySegments.map((segment) => ({
      type: 'assistant',
      content: segment.content,
      timestamp,
      ...(segment.isThinking ? { isThinking: true } : {}),
    }));
  }
  return [{ type: 'assistant', content, timestamp }];
}
