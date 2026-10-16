import type { Command } from './protocol';

let sender: ((command: Command) => void) | undefined;

export function setRemoteSender(value: typeof sender): () => void {
  sender = value;
  return () => {
    if (sender === value)
      sender = undefined;
  };
}

export function isRemoteFrontend(): boolean {
  return sender !== undefined;
}

export function sendRemoteCommand(command: Command): void {
  sender?.(command);
}
