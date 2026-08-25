import { MarkdownPostProcessor, setIcon } from 'obsidian';

import { Callout, CalloutConfig } from './settings';

function getFirstTextNode(li: HTMLElement) {
  for (const node of Array.from(li.childNodes)) {
    if (node.nodeType === document.ELEMENT_NODE && (node as HTMLElement).classList.contains('tasks-list-text')) {
      const descriptionNode = (node as HTMLElement).firstElementChild
      if (descriptionNode?.classList.contains('task-description')) {
        const textNode = descriptionNode.firstElementChild?.firstChild;
        if (textNode.nodeType === document.TEXT_NODE) {
          return textNode;
        }
      }
    }

    if (
      node.nodeType === document.ELEMENT_NODE &&
      (node as HTMLElement).tagName === 'P'
    ) {
      return node.firstChild;
    }

    if (node.nodeType !== document.TEXT_NODE) {
      continue;
    }

    if ((node as Text).nodeValue.trim() === '') {
      continue;
    }

    return node;
  }

  return null;
}

function findTagCallout(
  li: HTMLElement,
  tags: Record<string, Callout>
): Callout | null {
  for (const tag of Array.from(li.querySelectorAll<HTMLElement>('a.tag'))) {
    if (tag.closest('li') !== li) continue;

    const callout = tags[(tag.textContent || '').toLowerCase()];
    if (callout) return callout;
  }

  return null;
}

function insertTagMarker(li: HTMLElement, icon: string) {
  const contentNode = Array.from(li.childNodes).find((node) => {
    if (node.nodeType === document.TEXT_NODE) {
      return (node.textContent || '').trim() !== '';
    }

    const element = node as HTMLElement;
    return (
      !element.hasClass('list-collapse-indicator') &&
      !element.hasClass('list-bullet') &&
      !['UL', 'OL', 'INPUT'].includes(element.tagName)
    );
  });

  if (!contentNode) return;

  contentNode.before(
    createSpan(
      {
        cls: 'lc-list-marker',
        attr: { 'aria-hidden': 'true' },
      },
      (span) => setIcon(span, icon)
    )
  );
}

function wrapLiContent(li: HTMLElement) {
  const toReplace: ChildNode[] = [];
  let insertBefore = null;

  for (let i = 0, len = li.childNodes.length; i < len; i++) {
    const child = li.childNodes.item(i);

    if (child.nodeType === document.ELEMENT_NODE) {
      const el = child as Element;
      if (
        el.hasClass('list-collapse-indicator') ||
        el.hasClass('list-bullet')
      ) {
        continue;
      }

      if (['UL', 'OL'].includes(el.tagName)) {
        insertBefore = child;
        break;
      }
    }

    toReplace.push(child);
  }

  const wrapper = createSpan({ cls: 'lc-li-wrapper' });

  toReplace.forEach((node) => wrapper.append(node));

  if (insertBefore) {
    insertBefore.before(wrapper);
  } else {
    li.append(wrapper);
  }
}

export function buildPostProcessor(
  getConfig: () => CalloutConfig
): MarkdownPostProcessor {
  return async (el, ctx: any) => {
    const config = getConfig();

    if (ctx.promises?.length) {
      await Promise.all(ctx.promises);
    }

    el.findAll('li').forEach((li) => {
      const node = getFirstTextNode(li);
      const text = node?.textContent || '';
      const match = text ? text.match(config.re) : null;
      const prefixCallout = match ? config.callouts[match[1]] : null;
      const tagCallout =
        !prefixCallout && li.parentElement?.tagName === 'UL'
          ? findTagCallout(li, config.tags)
          : null;
      const callout = prefixCallout || tagCallout;
      if (!callout) return;

      li.addClass('lc-list-callout');
      li.setAttribute('data-callout', callout.char);
      li.style.setProperty('--lc-callout-color', callout.color);

      if (prefixCallout && node) {
        node.replaceWith(
          createFragment((f) => {
            f.append(
              createSpan(
                {
                  cls: 'lc-list-marker',
                  text: text.slice(0, prefixCallout.char.length),
                },
                (span) => {
                  if (prefixCallout.icon) {
                    setIcon(span, prefixCallout.icon);
                  }
                }
              )
            );
            f.append(text.slice(prefixCallout.char.length));
          })
        );
      } else if (tagCallout?.icon) {
        insertTagMarker(li, tagCallout.icon);
      }

      wrapLiContent(li);
    });
  };
}
