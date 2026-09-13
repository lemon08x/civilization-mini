import { lstat, mkdir, open, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { canonical } from './records.js';
import { replayRecord } from './replay.js';
import { submitCommand, validateRunId } from './session.js';
// 只写受控的 runId 子目录，不接受模型提供的文件路径。
export class FileRunStore {
    root;
    implementation;
    constructor(root, implementation) {
        this.root = root;
        this.implementation = implementation;
    }
    async directory(runId, create) {
        validateRunId(runId);
        const root = resolve(this.root);
        try {
            await lstat(root);
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
            await mkdir(root, { recursive: true });
        }
        if ((await realpath(root)).toLowerCase() !== root.toLowerCase())
            throw new Error('实验根目录不能通过链接指向其他位置');
        const directory = join(root, runId);
        if (create)
            await mkdir(directory, { recursive: false });
        const info = await lstat(directory);
        if (!info.isDirectory() || info.isSymbolicLink() || (await realpath(directory)).toLowerCase() !== directory.toLowerCase())
            throw new Error('实验目录无效');
        return directory;
    }
    async create(session) {
        const verified = await replayRecord(session.record, this.implementation);
        const directory = await this.directory(verified.record.manifest.runId, true);
        await writeFile(join(directory, 'record.json'), JSON.stringify(verified.record), { encoding: 'utf8', flag: 'wx' });
    }
    async load(runId) {
        const directory = await this.directory(runId, false);
        const path = join(directory, 'record.json');
        if ((await lstat(path)).isSymbolicLink())
            throw new Error('记录不能是符号链接');
        return replayRecord(JSON.parse(await readFile(path, 'utf8')), this.implementation);
    }
    async submit(runId, command) {
        const directory = await this.directory(runId, false);
        const lockPath = join(directory, '.write-lock');
        let lock;
        try {
            lock = await open(lockPath, 'wx');
        }
        catch (error) {
            if (error.code === 'EEXIST')
                throw new Error('此实验正在写入；若进程异常退出，请检查锁文件后人工恢复');
            throw error;
        }
        const temporary = join(directory, `.record-${process.pid}-${crypto.randomUUID()}.tmp`);
        try {
            await lock.writeFile(JSON.stringify({ pid: process.pid, commandId: command.commandId }));
            const current = await this.load(runId);
            const result = await submitCommand(current, command);
            if (result.duplicate)
                return result;
            const historyDirectory = join(directory, 'history');
            await mkdir(historyDirectory, { recursive: true });
            if ((await lstat(historyDirectory)).isSymbolicLink() || (await realpath(historyDirectory)).toLowerCase() !== historyDirectory.toLowerCase())
                throw new Error('历史目录无效');
            const backup = join(historyDirectory, `${current.record.entries.length}.json`);
            try {
                await writeFile(backup, JSON.stringify(current.record), { encoding: 'utf8', flag: 'wx' });
            }
            catch (error) {
                if (error.code !== 'EEXIST')
                    throw error;
                if ((await lstat(backup)).isSymbolicLink() || canonical(JSON.parse(await readFile(backup, 'utf8'))) !== canonical(current.record))
                    throw new Error('历史备份冲突，停止覆盖');
            }
            const file = await open(temporary, 'wx');
            try {
                await file.writeFile(JSON.stringify(result.session.record), 'utf8');
                await file.sync();
            }
            finally {
                await file.close();
            }
            await rename(temporary, join(directory, 'record.json'));
            return result;
        }
        finally {
            await lock.close();
            await unlink(lockPath);
            await unlink(temporary).catch(error => { if (error.code !== 'ENOENT')
                throw error; });
        }
    }
}
