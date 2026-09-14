import { posix } from 'node:path';
import MarkdownIt from 'markdown-it';
import { Parser } from 'htmlparser2';
import GithubSlugger from 'github-slugger';

const markdown = new MarkdownIt({ html: true });
const repositoryPrefix = 'https://github.com/flc1125/mote/';

// srcset URLs end at whitespace, not at embedded commas (e.g. data URLs).
export function srcsetUrls(value) {
  const urls = [];
  let rest = value;
  while (rest.length) {
    rest = rest.replace(/^[\s,]+/, '');
    if (!rest) break;
    const url = rest.match(/^\S+/)[0];
    urls.push(url.replace(/,+$/, ''));
    rest = rest.slice(url.length);
    if (!url.endsWith(',')) {
      const end = rest.indexOf(',');
      rest = end < 0 ? '' : rest.slice(end + 1);
    }
  }
  return urls;
}

export function parseDocument(source) {
  const tokens = markdown.parse(source, {});
  const anchors = new Set();
  const links = [];
  const errors = [];
  const slugger = new GithubSlugger();
  const addLink = (url, line) => links.push({ url, line });
  let codeDepth = 0;
  let htmlLine = 1;
  let htmlSource = '';
  let htmlOffset = 0;
  const html = new Parser({
    onopentag(name, attrs) {
      if (name === 'code' || name === 'pre') codeDepth++;
      const line =
        htmlLine + htmlSource.slice(0, html.startIndex - htmlOffset).split('\n').length - 1;
      if (attrs.id) anchors.add(attrs.id);
      if (name === 'a' && attrs.name) anchors.add(attrs.name);
      if (codeDepth) return;
      if (name === 'a' && attrs.href) addLink(attrs.href, line);
      if ((name === 'img' || name === 'source') && attrs.src) addLink(attrs.src, line);
      if ((name === 'img' || name === 'source') && attrs.srcset) {
        for (const url of srcsetUrls(attrs.srcset)) addLink(url, line);
      }
    },
    onclosetag(name) {
      if (name === 'code' || name === 'pre') codeDepth = Math.max(0, codeDepth - 1);
    },
  });
  function headingText(children) {
    return (children ?? [])
      .map((token) => {
        if (['text', 'code_inline'].includes(token.type)) return token.content;
        if (token.type === 'image') return headingText(token.children);
        return '';
      })
      .join('');
  }
  function walk(list, parentLine = 1) {
    for (const [index, token] of list.entries()) {
      const line = token.map ? token.map[0] + 1 : parentLine;
      if (token.type === 'heading_open') {
        anchors.add(slugger.slug(headingText(list[index + 1]?.children)));
      }
      if (token.type === 'link_open' && !codeDepth) addLink(token.attrGet('href'), line);
      if (token.type === 'image' && !codeDepth) addLink(token.attrGet('src'), line);
      if (token.type === 'html_inline' || token.type === 'html_block') {
        // Each token has its own source location; keep code/pre state across tokens.
        htmlLine = line;
        htmlSource = token.content;
        html.write(token.content);
        htmlOffset += token.content.length;
      }
      if (token.type === 'fence' && token.info.trim() === 'json') {
        try {
          JSON.parse(token.content);
        } catch (error) {
          errors.push({ line, message: `Invalid JSON code block: ${error.message}` });
        }
      }
      if (token.children && token.type !== 'image') walk(token.children, line);
    }
  }
  walk(tokens);
  html.end();
  return { anchors, links, errors };
}

export function repositoryLink(url) {
  if (!url.startsWith(repositoryPrefix)) return undefined;
  const match = /^(?:blob|tree)\/([^/]+)\/(.+)$/.exec(url.slice(repositoryPrefix.length));
  if (!match) return undefined;
  return { ref: match[1], path: match[2] };
}

export function checkDocuments(files, read, exists = () => true) {
  const tracked = new Set(files);
  const directories = new Set(['.']);
  for (const file of files) {
    let dir = posix.dirname(file);
    while (dir !== '.') {
      directories.add(dir);
      dir = posix.dirname(dir);
    }
  }
  const documents = new Map();
  const errors = [];
  for (const file of files.filter((file) => /\.md$/i.test(file))) {
    try {
      const source = read(file);
      const document = parseDocument(source);
      documents.set(file, { ...document, source });
      errors.push(...document.errors.map((error) => ({ file, ...error })));
    } catch (error) {
      errors.push({ file, line: 1, message: `Cannot read Markdown: ${error.message}` });
    }
  }
  let references = 0;
  let external = 0;
  for (const [file, document] of documents) {
    for (const { url, line } of document.links) {
      if (!url) continue;
      const repo = repositoryLink(url);
      if (repo?.ref !== 'main' && /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) {
        external++;
        continue;
      }
      references++;
      try {
        const link = repo?.ref === 'main' ? repo.path : url;
        const hash = link.indexOf('#');
        const path = (hash < 0 ? link : link.slice(0, hash)).split('?')[0];
        const anchor = hash < 0 ? '' : decodeURIComponent(link.slice(hash + 1));
        const decoded = decodeURIComponent(path);
        const target = decoded
          ? posix
              .normalize(
                decoded.startsWith('/') || repo
                  ? decoded.replace(/^\/+/, '')
                  : posix.join(posix.dirname(file), decoded),
              )
              .replace(/\/$/, '')
          : file;
        if ((!tracked.has(target) && !directories.has(target)) || !exists(target)) {
          errors.push({ file, line, message: `Untracked or missing target: ${url}` });
        } else if (anchor && /\.md$/i.test(target) && !documents.get(target)?.anchors.has(anchor)) {
          errors.push({ file, line, message: `Missing anchor: ${url}` });
        }
      } catch (error) {
        errors.push({ file, line, message: `Invalid reference ${url}: ${error.message}` });
      }
    }
  }
  return { documents, errors, references, external };
}
