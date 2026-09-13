export function parseIntentions(raw) {
    if (raw === null)
        return { format: 'life-intentions', schemaVersion: 1, entries: [] };
    const v = JSON.parse(raw);
    if (v?.format !== 'life-intentions' || v.schemaVersion !== 1 || !Array.isArray(v.entries) || !v.entries.every((e) => typeof e === 'object' && e !== null && Number.isSafeInteger(e.generation) && e.generation > 0 && Number.isSafeInteger(e.revision) && e.revision >= 0 && typeof e.text === 'string' && e.text.length <= 500))
        throw new Error('志向记录格式无效，原内容保留');
    return v;
}
