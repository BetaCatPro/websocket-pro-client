const patternRegexCache = new Map<string, RegExp>()

/**
 * topicPattern 匹配
 * - `*`：任意长度任意字符
 * - `?`：任意单个字符
 * - `{a,b}`：多备选
 */
export function matchTopicPattern(pattern: string, topic: string): boolean {
  if (pattern === topic) return true

  const hasSpecial = pattern.includes('*') || pattern.includes('?') || pattern.includes('{')
  if (!hasSpecial) return false

  const cached = patternRegexCache.get(pattern)
  if (cached) return cached.test(topic)

  const regexStr = buildTopicPatternRegexStr(pattern)
  const regex = new RegExp(regexStr)
  patternRegexCache.set(pattern, regex)
  return regex.test(topic)
}

function buildTopicPatternRegexStr(pattern: string): string {
  const escapeLiteral = (ch: string): string => {
    // 仅对“可能出现在正则语义里”的字符做转义
    if ('\\^$+?.()|[\\]{}'.includes(ch)) return `\\${ch}`
    return ch
  }

  const build = (p: string): string => {
    let res = ''
    for (let i = 0; i < p.length; i += 1) {
      const ch = p[i]
      if (ch === '*') {
        res += '.*'
        continue
      }
      if (ch === '?') {
        res += '.'
        continue
      }
      if (ch === '{') {
        const { content, endIndex } = extractBraceContent(p, i)
        const alternatives = splitBraceAlternatives(content)
        const inner = alternatives.map((alt) => build(alt)).join('|')
        res += `(?:${inner})`
        i = endIndex
        continue
      }
      res += escapeLiteral(ch)
    }
    return res
  }

  return `^${build(pattern)}$`
}

function extractBraceContent(
  p: string,
  startIndex: number,
): { content: string; endIndex: number } {
  let depth = 0
  for (let i = startIndex; i < p.length; i += 1) {
    const ch = p[i]
    if (ch === '{') depth += 1
    if (ch === '}') depth -= 1
    if (depth === 0) {
      const endIndex = i
      const content = p.slice(startIndex + 1, endIndex)
      return { content, endIndex }
    }
  }

  // 未闭合大括号：按字面量处理
  return { content: p.slice(startIndex + 1), endIndex: p.length - 1 }
}

function splitBraceAlternatives(content: string): string[] {
  const alternatives: string[] = []
  let depth = 0
  let current = ''

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i]
    if (ch === '{') depth += 1
    if (ch === '}') depth -= 1

    if (ch === ',' && depth === 0) {
      alternatives.push(current)
      current = ''
      continue
    }

    current += ch
  }

  alternatives.push(current)
  return alternatives
}

