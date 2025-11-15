export const sampleTrace = [
  {
    id: 0,
    label: 'Binder awaiting argument',
    root: 'root',
    nodes: [
      {
        id: 'root',
        kind: 'pair',
        label: '·',
        children: ['binder-application', 'arg-x'],
      },
      {
        id: 'binder-application',
        kind: 'pair',
        label: '(() body)',
        children: ['binder-core', 'body'],
      },
      {
        id: 'binder-core',
        kind: 'binder',
        label: 'λ₀',
        anchorKey: 'binder-0',
      },
      {
        id: 'body',
        kind: 'pair',
        label: 'body',
        children: ['slot-0', 'symbol-y'],
      },
      {
        id: 'slot-0',
        kind: 'slot',
        label: '#0',
        aliasKey: 'binder-0',
      },
      {
        id: 'symbol-y',
        kind: 'symbol',
        label: 'y',
      },
      {
        id: 'arg-x',
        kind: 'symbol',
        label: 'x',
      },
    ],
    links: [
      {
        id: 'loop-0',
        from: 'slot-0',
        to: 'binder-core',
      },
    ],
  },
  {
    id: 1,
    label: 'Slot retargets to argument',
    root: 'stage-1',
    nodes: [
      {
        id: 'stage-1',
        kind: 'pair',
        label: '·',
        children: ['body-mutated', 'arg-x'],
      },
      {
        id: 'body-mutated',
        kind: 'pair',
        label: 'body',
        children: ['arg-x', 'symbol-y'],
      },
      {
        id: 'arg-x',
        kind: 'symbol',
        label: 'x',
      },
      {
        id: 'symbol-y',
        kind: 'symbol',
        label: 'y',
      },
    ],
    links: [],
  },
  {
    id: 2,
    label: 'Collapse exposes focus',
    root: 'arg-x',
    nodes: [
      {
        id: 'arg-x',
        kind: 'symbol',
        label: 'x',
      },
    ],
    links: [],
  },
];
