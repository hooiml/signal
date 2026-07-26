import { parseResearchRecord, ResearchInputError } from './input';
import type { ResearchRecord } from '../types/research';

const backupFormat = 'signal-research-backup';
const backupVersion = 1;
const backupIterations = 310_000;
const backupAdditionalData = new TextEncoder().encode(`${backupFormat}:v${backupVersion}`);
const toArrayBuffer = (value: Uint8Array): ArrayBuffer => Uint8Array.from(value).buffer;

export const researchBackupLimits = {
    maxFileBytes: 2_000_000,
    maxRecords: 100,
    minPassphraseLength: 12,
    maxPassphraseLength: 256,
} as const;

export type ResearchRestoreConflictPolicy = 'add-only' | 'replace-existing';

export type ResearchBackupPayload = {
    readonly version: 1;
    readonly exportedAt: string;
    readonly records: readonly ResearchRecord[];
};

export type ResearchSyncPreview = {
    readonly newRecords: number;
    readonly incomingNewer: number;
    readonly localNewer: number;
    readonly sameRevision: number;
};

type ResearchBackupEnvelope = {
    readonly format: typeof backupFormat;
    readonly version: typeof backupVersion;
    readonly kdf: {
        readonly name: 'PBKDF2';
        readonly hash: 'SHA-256';
        readonly iterations: typeof backupIterations;
        readonly salt: string;
    };
    readonly cipher: {
        readonly name: 'AES-GCM';
        readonly iv: string;
    };
    readonly ciphertext: string;
};

export class ResearchBackupError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ResearchBackupError';
    }
}

const objectValue = (value: unknown, label: string): Record<string, unknown> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new ResearchBackupError(`${label} must be an object.`);
    }
    return Object.fromEntries(Object.entries(value));
};

const encodeBase64 = (value: Uint8Array): string => {
    let binary = '';
    for (const byte of value) binary += String.fromCharCode(byte);
    return btoa(binary);
};

const decodeBase64 = (value: unknown, label: string): Uint8Array => {
    if (typeof value !== 'string' || value.length === 0) throw new ResearchBackupError(`${label} is missing.`);
    try {
        const binary = atob(value);
        return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    } catch {
        throw new ResearchBackupError(`${label} is not valid base64.`);
    }
};

const validatePassphrase = (passphrase: string): void => {
    if (passphrase.length < researchBackupLimits.minPassphraseLength || passphrase.length > researchBackupLimits.maxPassphraseLength) {
        throw new ResearchBackupError(`Passphrase must contain ${researchBackupLimits.minPassphraseLength}-${researchBackupLimits.maxPassphraseLength} characters.`);
    }
};

const deriveKey = async (passphrase: string, salt: Uint8Array, usage: KeyUsage): Promise<CryptoKey> => {
    const material = await globalThis.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey'],
    );
    return globalThis.crypto.subtle.deriveKey(
        { name: 'PBKDF2', hash: 'SHA-256', salt: toArrayBuffer(salt), iterations: backupIterations },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        [usage],
    );
};

export const parseResearchBackupPayload = (value: unknown): ResearchBackupPayload => {
    const body = objectValue(value, 'Backup payload');
    if (body.version !== backupVersion) throw new ResearchBackupError('Backup payload version is unsupported.');
    if (typeof body.exportedAt !== 'string' || Number.isNaN(Date.parse(body.exportedAt))) {
        throw new ResearchBackupError('Backup export time is invalid.');
    }
    if (!Array.isArray(body.records)) throw new ResearchBackupError('Backup records must be an array.');
    if (body.records.length > researchBackupLimits.maxRecords) {
        throw new ResearchBackupError(`Backup contains more than ${researchBackupLimits.maxRecords} records.`);
    }
    try {
        const records = body.records.map(parseResearchRecord);
        const symbols = new Set<string>();
        for (const record of records) {
            if (symbols.has(record.symbol)) throw new ResearchBackupError(`Backup contains duplicate symbol ${record.symbol}.`);
            symbols.add(record.symbol);
        }
        return { version: backupVersion, exportedAt: new Date(body.exportedAt).toISOString(), records };
    } catch (error) {
        if (error instanceof ResearchBackupError) throw error;
        if (error instanceof ResearchInputError) throw new ResearchBackupError(`Backup record is invalid: ${error.message}`);
        throw error;
    }
};

const parseEnvelope = (value: unknown): ResearchBackupEnvelope => {
    const body = objectValue(value, 'Encrypted backup');
    const kdf = objectValue(body.kdf, 'Encrypted backup KDF');
    const cipher = objectValue(body.cipher, 'Encrypted backup cipher');
    if (body.format !== backupFormat || body.version !== backupVersion) throw new ResearchBackupError('Backup format or version is unsupported.');
    if (kdf.name !== 'PBKDF2' || kdf.hash !== 'SHA-256' || kdf.iterations !== backupIterations) throw new ResearchBackupError('Backup key derivation settings are unsupported.');
    if (cipher.name !== 'AES-GCM') throw new ResearchBackupError('Backup cipher is unsupported.');
    return {
        format: backupFormat,
        version: backupVersion,
        kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: backupIterations, salt: String(kdf.salt ?? '') },
        cipher: { name: 'AES-GCM', iv: String(cipher.iv ?? '') },
        ciphertext: String(body.ciphertext ?? ''),
    };
};

export const encryptResearchBackup = async (
    records: readonly ResearchRecord[],
    passphrase: string,
    exportedAt = new Date().toISOString(),
): Promise<string> => {
    validatePassphrase(passphrase);
    const payload = parseResearchBackupPayload({ version: backupVersion, exportedAt, records });
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt, 'encrypt');
    const encrypted = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: backupAdditionalData },
        key,
        new TextEncoder().encode(JSON.stringify(payload)),
    );
    const envelope = JSON.stringify({
        format: backupFormat,
        version: backupVersion,
        kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: backupIterations, salt: encodeBase64(salt) },
        cipher: { name: 'AES-GCM', iv: encodeBase64(iv) },
        ciphertext: encodeBase64(new Uint8Array(encrypted)),
    } satisfies ResearchBackupEnvelope);
    if (new TextEncoder().encode(envelope).byteLength > researchBackupLimits.maxFileBytes) {
        throw new ResearchBackupError('Encrypted backup is larger than 2 MB.');
    }
    return envelope;
};

export const decryptResearchBackup = async (encryptedBackup: string, passphrase: string): Promise<ResearchBackupPayload> => {
    validatePassphrase(passphrase);
    let parsed: unknown;
    try {
        parsed = JSON.parse(encryptedBackup);
    } catch {
        throw new ResearchBackupError('Backup file is not valid JSON.');
    }
    const envelope = parseEnvelope(parsed);
    const salt = decodeBase64(envelope.kdf.salt, 'Backup salt');
    const iv = decodeBase64(envelope.cipher.iv, 'Backup IV');
    if (salt.byteLength !== 16 || iv.byteLength !== 12) throw new ResearchBackupError('Backup encryption parameters are invalid.');
    try {
        const key = await deriveKey(passphrase, salt, 'decrypt');
        const decrypted = await globalThis.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: toArrayBuffer(iv), additionalData: backupAdditionalData },
            key,
            toArrayBuffer(decodeBase64(envelope.ciphertext, 'Backup ciphertext')),
        );
        return parseResearchBackupPayload(JSON.parse(new TextDecoder().decode(decrypted)));
    } catch (error) {
        if (error instanceof ResearchBackupError) throw error;
        throw new ResearchBackupError('Unable to decrypt backup. Check the passphrase and file.');
    }
};

export const parseResearchRestoreRequest = (value: unknown): {
    readonly conflictPolicy: ResearchRestoreConflictPolicy;
    readonly records: readonly ResearchRecord[];
} => {
    const body = objectValue(value, 'Restore request');
    if (body.conflictPolicy !== 'add-only' && body.conflictPolicy !== 'replace-existing') {
        throw new ResearchBackupError('Restore conflict policy is invalid.');
    }
    const payload = parseResearchBackupPayload({
        version: backupVersion,
        exportedAt: new Date().toISOString(),
        records: body.records,
    });
    return { conflictPolicy: body.conflictPolicy, records: payload.records };
};

export const buildResearchSyncPreview = (
    current: readonly ResearchRecord[],
    incoming: readonly ResearchRecord[],
): ResearchSyncPreview => {
    const currentBySymbol = new Map(current.map((record) => [record.symbol, record]));
    let newRecords = 0;
    let incomingNewer = 0;
    let localNewer = 0;
    let sameRevision = 0;
    for (const record of incoming) {
        const existing = currentBySymbol.get(record.symbol);
        if (!existing) {
            newRecords += 1;
        } else if (record.revision > existing.revision || (record.revision === existing.revision && record.updatedAt > existing.updatedAt)) {
            incomingNewer += 1;
        } else if (record.revision < existing.revision || record.updatedAt < existing.updatedAt) {
            localNewer += 1;
        } else {
            sameRevision += 1;
        }
    }
    return { newRecords, incomingNewer, localNewer, sameRevision };
};
