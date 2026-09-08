import type { MarkdownIt } from 'markdown-it';
// Both plugins ship no type declarations; @ts-expect-error keeps the
// imports honest while the wrappers below give them precise local types.
// @ts-expect-error -- untyped plugin
import footnotePlugin from 'markdown-it-footnote';
// @ts-expect-error -- untyped plugin
import taskListsPlugin from 'markdown-it-task-lists';

export interface TaskListsOptions {
  /** Enable checkbox interaction (requires JS — always false here). */
  enabled?: boolean;
  /** Wrap the checkbox and following text in a <label>. */
  label?: boolean;
  /** Place the checkbox after the text instead of before it. */
  labelAfter?: boolean;
}

export const footnote = footnotePlugin as (md: MarkdownIt) => void;
export const taskLists = taskListsPlugin as (md: MarkdownIt, options?: TaskListsOptions) => void;
