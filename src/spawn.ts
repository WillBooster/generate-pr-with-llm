import type { SpawnOptionsWithoutStdio } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { spawn } from 'node:child_process';
import ansis from 'ansis';

export async function runCommand(
  command: string,
  args: string[],
  options?: SpawnOptionsWithoutStdio & { ignoreExitStatus?: boolean; truncateStdout?: boolean }
): Promise<string> {
  const { ignoreExitStatus, ...spawnOptions } = options ?? {};
  const argsText = args.map((a) => (a.includes(' ') ? `"${a.replaceAll('"', '"')}"` : a)).join(' ');
  console.info(ansis.green(`$ ${command} ${argsText}`));

  console.info('stdout: ---------------------');
  const ret = await spawnAsync(command, args, spawnOptions);
  if (spawnOptions.truncateStdout) console.info(truncateOutput(ret.stdout));
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
  options?: SpawnOptionsWithoutStdio & { truncateStdout?: boolean }
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
        if (!options?.truncateStdout) process.stdout.write(data);
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

const TRUNCATE_THRESHOLD = 3000;

/**
 * Truncate output to prevent overwhelming console logs
 */
function truncateOutput(output: string): string {
  if (output.length <= TRUNCATE_THRESHOLD) {
    return output;
  }

  const truncated = output.slice(0, TRUNCATE_THRESHOLD);
  const omitted = output.length - TRUNCATE_THRESHOLD;
  return `${truncated}\n\n... (${omitted} characters truncated) ...`;
}
