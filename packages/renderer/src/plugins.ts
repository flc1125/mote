import type { MarkdownIt } from 'markdown-it';
// The plugin ships no type declarations; @ts-expect-error keeps the
// import honest while the wrapper below gives it a precise local type.
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

export const taskLists = taskListsPlugin as (md: MarkdownIt, options?: TaskListsOptions) => void;
