# Code block reading checks

Publish this synthetic specimen to check code titles, highlighted lines, line numbers and copying. The displayed numbers and toolbar text must never enter copied code. With JavaScript disabled, titles and highlighting remain visible and code can be selected manually.

## 1. File title and physical line highlighting

Numbers start at 10; the second and third physical lines are highlighted.

```ts title="config.ts" linenums="10" hl_lines="2-3"
const config = {
  timeout: 3000,
  retries: 2,
};
```

## 2. Multiline highlighting

The comment and template string cross line boundaries. Copying preserves all four lines and the trailing newline; only the second line is emphasized.

```js title="multiline.js" linenums="1" hl_lines="2"
/* first
second */
const message = `hello
world`;
```

## 3. Plain code and escaped markup

The following is literal code, not an image or an executable element.

```text title="literal.txt"
<img src="not-an-asset.png" onerror="notExecuted()">
```

## 4. Invalid metadata

The invalid starting number discards the entire metadata tail. There is no file title or line numbering; JavaScript highlighting and copying still work.

```js title="must-not-appear.js" linenums="0"
const unchanged = true;
```

## 5. Narrow screens and printing

This long line scrolls inside its code block on a narrow viewport. In print, it wraps and the copy controls disappear.

```text title="long-line.txt"
abcdefghijklmnopqrstuvwxyz0123456789 / abcdefghijklmnopqrstuvwxyz0123456789 / abcdefghijklmnopqrstuvwxyz0123456789 / abcdefghijklmnopqrstuvwxyz0123456789
```

## 6. Native folding

<details>
<summary>Expand to copy the command</summary>

```bash title="Terminal"
printf '%s\n' 'Hello from Mote'
```

</details>
