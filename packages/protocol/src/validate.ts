import {
  isAssetId,
  isDocumentId,
  isSha256Hex,
  isSupportedImageMimeType,
  MAX_ASSET_COUNT,
  validationFail,
  validationOk,
  type ValidationResult,
} from '@mote/core';

import { MANIFEST_VERSION, type DocumentManifest, type PublishManifest } from './manifest.js';
import { parseAssetFieldIndex } from './publish.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function checkReferences(value: unknown, where: string, issues: string[]): void {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isNonEmptyString)) {
    issues.push(`${where} must be a non-empty array of non-empty strings`);
  }
}

/** Validates the client-supplied publish manifest (baseline §16). */
export function validatePublishManifest(value: unknown): ValidationResult {
  const issues: string[] = [];

  if (!isRecord(value)) return validationFail(['manifest must be an object']);

  if (value.version !== MANIFEST_VERSION) {
    issues.push(`version must be ${MANIFEST_VERSION}`);
  }
  if (!isNonEmptyString(value.entry)) {
    issues.push('entry must be a non-empty string');
  }
  if (!Array.isArray(value.assets)) {
    issues.push('assets must be an array');
  } else {
    if (value.assets.length > MAX_ASSET_COUNT) {
      issues.push(`assets has ${value.assets.length} entries, limit is ${MAX_ASSET_COUNT}`);
    }
    const seenFields = new Set<string>();
    value.assets.forEach((asset, index) => {
      const where = `assets[${index}]`;
      if (!isRecord(asset)) {
        issues.push(`${where} must be an object`);
        return;
      }
      if (typeof asset.field !== 'string' || parseAssetFieldIndex(asset.field) === null) {
        issues.push(`${where}.field must look like "asset_N"`);
      } else if (seenFields.has(asset.field)) {
        issues.push(`${where}.field ${JSON.stringify(asset.field)} is duplicated`);
      } else {
        seenFields.add(asset.field);
      }
      checkReferences(asset.references, `${where}.references`, issues);
    });
  }

  return issues.length === 0 ? validationOk() : validationFail(issues);
}

/** Validates the stored document manifest (baseline §10). */
export function validateDocumentManifest(value: unknown): ValidationResult {
  const issues: string[] = [];

  if (!isRecord(value)) return validationFail(['manifest must be an object']);

  if (value.version !== MANIFEST_VERSION) {
    issues.push(`version must be ${MANIFEST_VERSION}`);
  }
  if (!isDocumentId(value.id)) {
    issues.push('id must be a 16-char Base58 document ID');
  }
  if (typeof value.createdAt !== 'string' || Number.isNaN(Date.parse(value.createdAt))) {
    issues.push('createdAt must be a parseable ISO timestamp');
  }

  if (!isRecord(value.source)) {
    issues.push('source must be an object');
  } else {
    if (!isNonEmptyString(value.source.name)) issues.push('source.name must be a non-empty string');
    if (!isNonNegativeNumber(value.source.size)) {
      issues.push('source.size must be a non-negative number');
    }
    if (!isSha256Hex(value.source.sha256)) {
      issues.push('source.sha256 must be a 64-char lowercase hex string');
    }
  }

  if (!Array.isArray(value.assets)) {
    issues.push('assets must be an array');
  } else {
    if (value.assets.length > MAX_ASSET_COUNT) {
      issues.push(`assets has ${value.assets.length} entries, limit is ${MAX_ASSET_COUNT}`);
    }
    value.assets.forEach((asset, index) => {
      const where = `assets[${index}]`;
      if (!isRecord(asset)) {
        issues.push(`${where} must be an object`);
        return;
      }
      if (!isAssetId(asset.id)) issues.push(`${where}.id must be a 12-char Base58 asset ID`);
      checkReferences(asset.references, `${where}.references`, issues);
      if (!isSupportedImageMimeType(asset.contentType)) {
        issues.push(`${where}.contentType is not a supported image type`);
      }
      if (!isNonNegativeNumber(asset.size)) {
        issues.push(`${where}.size must be a non-negative number`);
      }
      if (!isSha256Hex(asset.sha256)) {
        issues.push(`${where}.sha256 must be a 64-char lowercase hex string`);
      }
    });
  }

  return issues.length === 0 ? validationOk() : validationFail(issues);
}

export function isPublishManifest(value: unknown): value is PublishManifest {
  return validatePublishManifest(value).ok;
}

export function isDocumentManifest(value: unknown): value is DocumentManifest {
  return validateDocumentManifest(value).ok;
}
