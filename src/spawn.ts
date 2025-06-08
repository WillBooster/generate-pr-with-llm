import type { SpawnOptionsWithoutStdio } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { spawn } from 'node:child_process';
import ansis from 'ansis';

export async function runCommand(
  command: string,
  args: string[],
  options?: SpawnOptionsWithoutStdio & { ignoreExitStatus?: boolean }
): Promise<string> {
  const { ignoreExitStatus, ...spawnOptions } = options ?? {};
  const argsText = args.map((a) => (a.includes(' ') ? `"${a.replaceAll('"', '"')}"` : a)).join(' ');
  console.info(ansis.green(`$ ${command} ${argsText}`));
  console.info('stdout: ---------------------');
  const ret = await spawnAsync(command, args, spawnOptions);

  // Truncate stdout for display but return the full output
  const truncatedStdout = truncateOutput(ret.stdout);
  console.info(truncatedStdout);

  const stderr = ret.stderr.trim();
  if (stderr) {
    console.info('stderr: ---------------------');
    const truncatedStderr = truncateOutput(stderr);
    console.info(ansis.yellow(truncatedStderr));
  }
  console.info('-----------------------------');
  console.info(ansis.magenta(`Exit code: ${ret.status}\n`));
  if (!ignoreExitStatus && ret.status !== 0 && ret.status !== null) {
    process.exit(ret.status);
  }
  return ret.stdout;
}

export async function spawnAsync(
  command: string,
  args?: ReadonlyArray<string>,
  options?: SpawnOptionsWithoutStdio
): Promise<Omit<SpawnSyncReturns<string>, 'output' | 'error'>> {
  return new Promise((resolve, reject) => {
    try {
      // Sanitize args to remove null bytes
      const sanitizedArgs = (args ?? []).map((arg) => arg.replace(/\0/g, ''));
      const proc = spawn(command, sanitizedArgs, options);
      // `setEncoding` is undefined in Bun
      proc.stdout?.setEncoding?.('utf8');
      proc.stderr?.setEncoding?.('utf8');

      let stdout = '';
      let stderr = '';
      proc.stdout?.on('data', (data) => {
        process.stdout.write(data);
        stdout += data;
      });
      proc.stderr?.on('data', (data) => {
        stderr += data;
      });

      proc.on('error', (error) => {
        reject(error);
      });
      proc.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        if (proc.pid === undefined) {
          reject(new Error('Process has no pid.'));
        } else {
          resolve({
            pid: proc.pid,
            stdout,
            stderr,
            status: code,
            signal,
          });
        }
      });
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      reject(error);
    }
  });
}

/**
 * Truncate output to prevent overwhelming console logs
 */
function truncateOutput(output: string): string {
  const MAX_OUTPUT_LENGTH = 5000; // Maximum characters to display
  const TRUNCATE_THRESHOLD = 3000; // Start truncating after this many characters

  if (output.length <= MAX_OUTPUT_LENGTH) {
    return output;
  }

  const lines = output.split('\n');
  let truncatedOutput = '';
  let currentLength = 0;
  let truncatedLines = 0;

  // Include lines from the beginning until we hit the threshold
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineWithNewline = `${line}\n`;

    if (currentLength + lineWithNewline.length > TRUNCATE_THRESHOLD) {
      // Calculate how many lines we're skipping
      const remainingLines = lines.length - i;
      truncatedLines = remainingLines;
      break;
    }

    truncatedOutput += lineWithNewline;
    currentLength += lineWithNewline.length;
  }

  // Add truncation notice
  if (truncatedLines > 0) {
    truncatedOutput += `\n... (${truncatedLines} lines truncated, ${output.length - currentLength} characters omitted) ...\n`;

    // Include some lines from the end if there's room
    const endLinesToShow = Math.min(10, Math.floor((MAX_OUTPUT_LENGTH - truncatedOutput.length) / 50));
    if (endLinesToShow > 0 && lines.length > endLinesToShow) {
      const endLines = lines.slice(-endLinesToShow);
      truncatedOutput += '\n... (showing last few lines) ...\n';
      truncatedOutput += endLines.join('\n');
    }
  }

  return truncatedOutput;
}
