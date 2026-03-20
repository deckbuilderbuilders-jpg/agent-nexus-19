

## Fix: Strip [LEARNINGS] from visible chat

**Problem**: The LLM outputs `[LEARNINGS] ```json {...} ``` ` as raw text in the chat stream, which gets displayed to the user.

**Fix**: In `src/components/ChatView.tsx`, add a helper that strips everything from `[LEARNINGS]` onward before displaying the message content.

### Changes

**`src/components/ChatView.tsx`**
- Add a `stripLearnings(text)` function that removes `[LEARNINGS]` and everything after it from displayed text
- Apply it in the `onToken` callback when setting message content, and in the message render

This is a ~5 line change. The learnings data still flows through the backend's separate `learnings` SSE event, so saving knowledge still works — it just won't be visible as raw text.

