<img src="https://raw.githubusercontent.com/flc1125/mote/9421d349bf3d22322268ec5f463a8e3a34ddd09f/docs/assets/logo.png" alt="Mote" width="200">

# Small changes, clearer reading

**Studio notes · Week 36**  
A sample project update, published from Markdown with Mote.

This is a fictional team's weekly report. The names, numbers, and project results below are illustrative, so you can explore a complete document without needing any background context.

## This week at a glance

We spent this week improving a reading experience: shorter introductions, calmer tables, and clearer next steps. The changes are small individually, but together they make a long document easier to navigate.

**The main decision:** finish the reading flow before adding more features.

> A useful project update should help someone understand what changed, why it matters, and what happens next — even if they missed the meeting.

## What changed

### A more focused introduction

The opening now gives readers the outcome first. Supporting details follow in short paragraphs, and section headings make it easier to find a specific answer later.

我们也保留了中英文混排的内容。一份好的周报不需要复杂的版式：结论放在前面，数据放进表格，需要补充的背景放在后面。读者可以快速浏览，也可以顺着目录深入阅读。

### A quieter visual rhythm

- **Headings** separate the major ideas without interrupting the reading flow.
- **Tables** keep comparable information together, with numbers aligned to the right.
- **Quotes** give a decision or observation its own space.
- **Inline code**, such as `readingTime`, distinguishes a technical detail from the surrounding prose.

## Progress by workstream

We completed 12 of the 15 planned tasks. The remaining work is concentrated in the mobile review and the handoff notes.

| Workstream        | Planned | Completed | Status              |
| :---------------- | ------: | --------: | :------------------ |
| Reading layout    |       5 |         5 | Ready for review    |
| Mobile experience |       4 |         3 | One check remaining |
| Content examples  |       3 |         3 | Ready for review    |
| Handoff notes     |       3 |         1 | In progress         |
| **Total**         |  **15** |    **12** | **80% complete**    |

These counts describe this fictional project; they are not Mote usage or performance metrics.

## A small implementation detail

For the report summary, we calculate progress from completed tasks. Keeping the function small makes its behavior easy to review.

```typescript
function completionRate(completed: number, planned: number): number {
  if (planned <= 0) return 0;
  return Math.round((completed / planned) * 100);
}

const progress = completionRate(12, 15); // 80
```

The number belongs beside the task counts, where readers can understand what it represents. It does not need to become the largest element on the page.

## Next week

- [x] Agree on the reading priorities.
- [x] Prepare a complete sample document.
- [ ] Review narrow screens and long table content.
- [ ] Finish the handoff notes with the decisions and open questions.

**Open question:** should the next update include a short change log, or would a link to the previous report be enough?

<details>
<summary>Behind the report: what this page demonstrates</summary>

This page combines an image, English and Chinese prose, linked headings, a blockquote, a table, a fenced code block, a task list, and a collapsible note. Use **Contents** at the top of the page to jump between sections.

The source is ordinary Markdown with a small amount of presentational HTML for the image and this note. The image is served from a fixed revision of Mote's public repository.

</details>

---

Want to share a document like this? Start with the [Mote documentation](https://github.com/flc1125/mote/blob/main/docs/cli.md), or return to the [homepage](https://mote.pub/).
