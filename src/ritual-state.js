const REQUIRED_DROPS = 3;
const RITUAL_KINDS = new Set(['diya', 'skyshot']);

export function createRitual(kind) {
  if (!RITUAL_KINDS.has(kind)) {
    throw new TypeError(`Unknown ritual kind: ${kind}`);
  }

  return {
    kind,
    successfulDrops: 0,
    status: 'collecting',
  };
}

export function applyDrop(state, hitTarget) {
  if (!hitTarget || state.status === 'complete') {
    return {
      accepted: false,
      completed: false,
      state,
    };
  }

  const successfulDrops = Math.min(state.successfulDrops + 1, REQUIRED_DROPS);
  const completed = successfulDrops === REQUIRED_DROPS;

  return {
    accepted: true,
    completed,
    state: {
      ...state,
      successfulDrops,
      status: completed ? 'complete' : 'collecting',
    },
  };
}
