type NotificationHandler = (message: string) => void;

interface NotificationOwner {
  handler: NotificationHandler;
  previous: NotificationOwner | undefined;
  active: boolean;
}

let currentOwner: NotificationOwner | undefined;
const pending: string[] = [];

function fallback(message: string): void {
  pending.push(message);
  if (pending.length > 20)
    pending.shift();
}

/** Show simulator feedback in the active devtools frontend. */
export function notify(message: string): void {
  (currentOwner?.handler ?? fallback)(message);
}

/**
 * Routes simulator feedback to an owning frontend and returns an owner-safe
 * cleanup callback. The UI owner sends messages to Nuxt UI's toaster.
 */
export function setNotificationHandler(
  nextHandler?: NotificationHandler,
): () => void {
  const owner: NotificationOwner = {
    handler: nextHandler ?? fallback,
    previous: currentOwner,
    active: true,
  };
  currentOwner = owner;
  if (nextHandler) {
    for (const message of pending.splice(0))
      nextHandler(message);
  }

  return () => {
    owner.active = false;
    if (currentOwner !== owner)
      return;
    do {
      currentOwner = currentOwner.previous;
    } while (currentOwner && !currentOwner.active);
  };
}
