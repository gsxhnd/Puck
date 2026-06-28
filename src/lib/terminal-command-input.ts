export type CommandInputState = {
  buffer: string;
};

function consumeEscapeSequence(data: string, start: number): number {
  if (data[start] !== "\x1b") {
    return start + 1;
  }

  if (start + 1 >= data.length) {
    return data.length;
  }

  const next = data[start + 1];

  if (next === "[") {
    let index = start + 2;
    while (index < data.length && !/[A-Za-z~]/.test(data[index]!)) {
      index += 1;
    }
    return Math.min(index + 1, data.length);
  }

  if (next === "]") {
    const end = data.indexOf("\x07", start + 2);
    if (end !== -1) {
      return end + 1;
    }
    const stEnd = data.indexOf("\x1b\\", start + 2);
    if (stEnd !== -1) {
      return stEnd + 2;
    }
    return data.length;
  }

  return start + 2;
}

export function parseTerminalInput(
  data: string,
  state: CommandInputState,
): string | null {
  let submitted: string | null = null;
  let index = 0;

  while (index < data.length) {
    const char = data[index]!;

    if (char === "\x1b") {
      index = consumeEscapeSequence(data, index);
      continue;
    }

    if (char === "\r" || char === "\n") {
      const command = state.buffer.trim();
      state.buffer = "";
      if (command) {
        submitted = command;
      }
      index += 1;
      continue;
    }

    if (char === "\x7f" || char === "\b") {
      state.buffer = state.buffer.slice(0, -1);
      index += 1;
      continue;
    }

    if (char === "\x03" || char === "\x15" || char === "\x17") {
      state.buffer = "";
      index += 1;
      continue;
    }

    const code = char.charCodeAt(0);
    if (code >= 32 || char === "\t") {
      state.buffer += char;
    }

    index += 1;
  }

  return submitted;
}
