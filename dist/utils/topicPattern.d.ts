/**
 * topicPattern 匹配
 * - `*`：任意长度任意字符
 * - `?`：任意单个字符
 * - `{a,b}`：多备选
 */
export declare function matchTopicPattern(pattern: string, topic: string): boolean;
