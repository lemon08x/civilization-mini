import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Command, Session } from './records.js';
import { parseSession, submitCommand, validateRunId } from './session.js';

export class FileRunStore {
  constructor(private readonly root: string) {}
  private directory(runId: string): string {
    validateRunId(runId);
    return join(resolve(this.root), runId);
  }
  private async write(directory: string, session: Session): Promise<void> {
    const temporary = join(directory, `.record-${process.pid}-${crypto.randomUUID()}.tmp`);
    try {
      await writeFile(temporary, JSON.stringify({ record: session.record, state: session.state }), 'utf8');
      await rename(temporary, join(directory, 'record.json'));
    } finally {
      await unlink(temporary).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; });
    }
  }
  async create(session: Session): Promise<void> {
    await mkdir(resolve(this.root), { recursive: true });
    const directory = this.directory(session.record.manifest.runId);
    await mkdir(directory, { recursive: false });
    await this.write(directory, session);
  }
  async load(runId: string): Promise<Session> {
    const path = join(this.directory(runId), 'record.json');
    return parseSession(JSON.parse(await readFile(path, 'utf8')) as unknown);
  }
  async submit(runId: string, command: Command): Promise<{ session: Session; duplicate: boolean; revision: number }> {
    const current = await this.load(runId);
    const result = await submitCommand(current, command);
    if (result.duplicate) return result;
    await this.write(this.directory(runId), result.session);
    return result;
  }
}
