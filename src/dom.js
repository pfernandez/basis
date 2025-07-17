/**
 * Stateless functional UI elements and components. Example usage:
 *
 * ```js
 * import sidebar from 'components/nav/sidebar.js';
 *
 * export const counter = (count = 0, props = {}) =>
 *   div(
 *     { className: props.className },
 *     pre(count),
 *     button({ onclick: () => Counter(count + 1, props) }, 'Increment'),
 *     ...(props.children || []));
 *
 *   html(
 *     head(
 *       title('git-blog'),
 *       meta({ name: 'viewport', content: 'width=device-width, initial-scale=1' }),
 *       link({ rel: 'icon', href: 'favicon.ico' }),
 *       link({ rel: 'stylesheet', href: 'style.css' })),
 *     body(
 *       header(
 *         hgroup(
 *           h1(a({ href: '/' }, 'git-blog')),
 *           h2('Github blogging for the masses'))),
 *       nav(sidebar()),
 *       main(
 *         div(
 *           { className: 'counter-section' },
 *           h3('Demo Counter 1'),
 *           counter(0, { className: 'counter primary' }),
 *           h3('Demo Counter 2'),
 *           counter(5, { className: 'counter secondary' })))));
 * ```
 */

const elements = new WeakMap() // Track Live Elements by [componentFn, instanceId]
const refs = new WeakMap() // Track DOM references
const state = new WeakMap() // Store component state
const instanceIds = new WeakMap() // Track instance IDs

// SVG elements that need special namespace handling
const svgElements = new Set([
  'svg', 'circle', 'ellipse', 'g', 'line', 'path', 'polygon', 
  'polyline', 'rect', 'text', 'defs', 'marker', 'use'
])

// Enhanced createElement
export function createElement(tagName, nodeOrProperties, ...nodes) {
  if (
    typeof tagName === 'string' &&
    !document.createElement(tagName).constructor === HTMLElement
  ) {
    const props = isProperties(nodeOrProperties) ? nodeOrProperties : {}
    const children = isProperties(nodeOrProperties)
      ? nodes
      : [nodeOrProperties, ...nodes]
    const element = document.createElement('div') // No data-tag
    attachSubtree({
      element,
      properties: props,
      childNodes: processChildren(children)
    })
    refs.set(element, { tagName, properties: props, childNodes: children })
    return element
  }

  const { element, properties, childNodes } = prepare(
    tagName,
    nodeOrProperties,
    nodes
  )
  attachSubtree({
    element,
    properties,
    childNodes: processChildren(childNodes)
  })
  refs.set(element, { tagName, properties, childNodes })
  return element
}

// Process children to handle component functions
function processChildren(nodes) {
  return nodes.flat().map(node => {
    if (typeof node === 'function') {
      const componentFn = node
      const instanceId = Symbol()
      const mapKey = [componentFn, instanceId]

      if (!state.has(mapKey)) {
        const initialCount = node.count || 0
        const initialProps = node.props || {}
        state.set(mapKey, { count: initialCount, props: initialProps })
      }
      const currentState = state.get(mapKey)

      const wrappedFn = (count, props) => {
        state.set(mapKey, { count, props })
        const element = componentFn(count, props)
        element.count = count // Attach for event handlers
        element.props = props
        return element
      }

      let elementData = elements.get(mapKey)
      const isUpdate = !!elementData

      elementData = wrappedFn(currentState.count, currentState.props)
      elements.set(mapKey, { element: elementData, instanceId })
      refs.set(elementData, {
        tagName: elementData.tagName,
        properties: {},
        childNodes: []
      })
      instanceIds.set(elementData, instanceId)

      elementData.setAttribute('data-live', instanceId.toString())
      return elementData
    }
    return node
  })
}

// Optimized updateRef
function updateRef(targetEl, newEl) {
  if (!refs.has(targetEl) || targetEl.tagName !== newEl.tagName) {
    targetEl.replaceWith(newEl)
    refs.set(newEl, refs.get(newEl) || { tagName: newEl.tagName })
    return newEl
  }
  // Diff attributes
  const oldAttrs = Object.fromEntries(
    [...targetEl.attributes].map(a => [a.name, a.value])
  )
  const newAttrs = Object.fromEntries(
    [...newEl.attributes].map(a => [a.name, a.value])
  )
  if (JSON.stringify(oldAttrs) !== JSON.stringify(newAttrs)) {
    Object.entries(newAttrs).forEach(([key, value]) =>
      targetEl.setAttribute(key, value)
    )
    Object.keys(oldAttrs).forEach(
      key => !newAttrs[key] && targetEl.removeAttribute(key)
    )
  }
  // Diff children
  const oldChildren = Array.from(targetEl.childNodes)
  const newChildren = Array.from(newEl.childNodes)
  const minLength = Math.min(oldChildren.length, newChildren.length)
  for (let i = 0; i < minLength; i++) {
    if (
      oldChildren[i].nodeType === Node.TEXT_NODE &&
      newChildren[i].nodeType === Node.TEXT_NODE
    ) {
      if (oldChildren[i].textContent !== newChildren[i].textContent) {
        oldChildren[i].textContent = newChildren[i].textContent
      }
    } else {
      updateRef(oldChildren[i], newChildren[i])
    }
  }
  for (let i = minLength; i < oldChildren.length; i++) {
    targetEl.removeChild(oldChildren[i])
  }
  for (let i = minLength; i < newChildren.length; i++) {
    targetEl.appendChild(newChildren[i])
  }
  return targetEl
}

// Modified assignProperties with explicit event list
const eventHandlers = new Set([
  'onclick',
  'onchange',
  'oninput',
  'onsubmit',
  'onmouseover',
  'onmouseout',
  'onfocus',
  'onblur',
  'onkeydown',
  'onkeyup',
  'onkeypress',
  'onload',
  'onerror',
  'onmousedown',
  'onmouseup',
  'onmousemove',
  'onwheel',
  'onscroll',
  'onresize',
  'onselect',
  'onpaste',
  'oncopy',
  'oncut',
  'ondrag',
  'ondrop'
])

const assignProperties = (element, properties, instanceContext = null) =>
  Object.entries(properties).reduce((el, [key, value]) => {
    if (
      eventHandlers.has(key) &&
      typeof value === 'function' &&
      instanceContext
    ) {
      // Wrap event handlers
      const { componentFn, instanceId, mapKey, wrappedFn } = instanceContext
      el[key] = (...args) => {
        const newElement = value.apply(el, args)
        if (newElement instanceof HTMLElement) {
          const currentState = state.get(mapKey)
          state.set(mapKey, {
            count: newElement.count,
            props: newElement.props
          })
          const existing =
            document.querySelector(`[data-live="${instanceId.toString()}"]`) ||
            el.closest('[data-live]')
          updateRef(existing, newElement)
          instanceIds.set(newElement, instanceId)
        }
      }
    } else if (key in el) {
      el[key] = value
    }
    if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      assignProperties(el[key], value, instanceContext)
    }
    return el
  }, element)

const attachSubtree = (
  { element, properties, childNodes },
  instanceContext = null
) => (
  childNodes.length && element.replaceChildren(...childNodes),
  assignProperties(element, properties, instanceContext)
)

const baseElement = tagName =>
  'html' === tagName
    ? document.documentElement
    : ['head', 'body'].includes(tagName) && document[tagName]
      ? document[tagName]
      : 'imgmap' === tagName
        ? document.createElement('map')
        : svgElements.has(tagName)
          ? document.createElementNS('http://www.w3.org/2000/svg', tagName)
          : document.createElement(tagName)

const isProperties = x =>
  typeof x === 'object' &&
  !Array.isArray(x) &&
  !(x instanceof Node) &&
  x !== null

const validChildren = nodes =>
  nodes.filter(x => x !== null && typeof x !== 'undefined')

const prepare = (tagName, x, childNodes) => ({
  element: baseElement(tagName),
  ...(isProperties(x)
    ? { childNodes: validChildren(childNodes), properties: x }
    : { childNodes: validChildren([x, ...childNodes]), properties: {} })
})

const appendChildren = (element, ...children) => (
  element.append(...children),
  element
)

// Tag-specific functions
const tagNames = [
  'a',
  'abbr',
  'address',
  'area',
  'article',
  'aside',
  'audio',
  'b',
  'base',
  'bdi',
  'bdo',
  'blockquote',
  'body',
  'br',
  'button',
  'canvas',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'data',
  'datalist',
  'dd',
  'del',
  'details',
  'dfn',
  'dialog',
  'div',
  'dl',
  'dt',
  'em',
  'embed',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hgroup',
  'hr',
  'html',
  'i',
  'iframe',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'legend',
  'li',
  'link',
  'main',
  'mark',
  'menu',
  'meta',
  'meter',
  'nav',
  'noscript',
  'object',
  'ol',
  'optgroup',
  'option',
  'output',
  'p',
  'param',
  'picture',
  'pre',
  'progress',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'script',
  'section',
  'select',
  'slot',
  'small',
  'source',
  'span',
  'strong',
  'style',
  'sub',
  'summary',
  'sup',
  'svg',
  'table',
  'tbody',
  'td',
  'template',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'title',
  'tr',
  'track',
  'u',
  'ul',
  'var',
  'video',
  'wbr',
  // SVG elements for graph visualization
  'circle',
  'ellipse',
  'g',
  'line',
  'path',
  'polygon',
  'polyline',
  'rect',
  'text'
]

const defaultElements = tagNames.reduce(
  (functions, tagName) => ({
    ...functions,
    [tagName]: (childOrProperties, ...childNodes) =>
      createElement(tagName, childOrProperties, ...childNodes)
  }),
  {
    fragment: (...childNodes) =>
      appendChildren(document.createDocumentFragment(), ...childNodes)
  }
)

export const {
  fragment,
  imgmap,
  a,
  abbr,
  address,
  area,
  article,
  aside,
  audio,
  b,
  base,
  bdi,
  bdo,
  blockquote,
  body,
  br,
  button,
  canvas,
  caption,
  cite,
  code,
  col,
  colgroup,
  data,
  datalist,
  dd,
  del,
  details,
  dfn,
  dialog,
  div,
  dl,
  dt,
  em,
  embed,
  fieldset,
  figcaption,
  figure,
  footer,
  form,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  head,
  header,
  hgroup,
  hr,
  html,
  i,
  iframe,
  img,
  input,
  ins,
  kbd,
  label,
  legend,
  li,
  link,
  main,
  mark,
  menu,
  meta,
  meter,
  nav,
  noscript,
  object,
  ol,
  optgroup,
  option,
  output,
  p,
  param,
  picture,
  pre,
  progress,
  q,
  rp,
  rt,
  ruby,
  s,
  samp,
  script,
  section,
  select,
  slot,
  small,
  source,
  span,
  strong,
  style,
  sub,
  summary,
  sup,
  svg,
  table,
  tbody,
  td,
  template,
  textarea,
  tfoot,
  th,
  thead,
  time,
  title,
  tr,
  track,
  u,
  ul,
  video,
  wbr,
  // SVG elements for graph visualization
  circle,
  ellipse,
  g,
  line,
  path,
  polygon,
  polyline,
  rect,
  text
} = defaultElements
