/* eslint-disable no-plusplus*/
import { resolve, isAbsolute } from 'pathe';
import pm from 'picomatch';

import type { CreateFilter } from '../types';

import ensureArray from './utils/ensureArray';
import normalizePath from './normalizePath';

const joinPath = (base: string, path: string) => {
  // If the path contains '..' or '.', normalize the path first
  if (path.includes('./') || path.includes('../') || path === '.' || path === '..') {
    // Split path into segments
    const segments = path.split('/');
    const resultSegments = [];

    // Track how many levels we need to go up from the base
    let upCount = 0;

    for (const segment of segments) {
      if (segment === '..') {
        // If we have segments in the result, pop the last one
        if (resultSegments.length > 0) {
          resultSegments.pop();
        } else {
          // If no segments left, we need to go up from the base
          upCount++;
        }
      } else if (segment !== '.' && segment !== '') {
        // If segment is not '.' or empty string, add it to the result
        resultSegments.push(segment);
      }
    }

    // Construct the final path
    let finalPath = resultSegments.join('/');

    // If we need to go up from the base, add the appropriate number of '../'
    if (upCount > 0 && base) {
      // Split the base into segments
      const baseSegments = base.split('/');

      // If we need to go up more levels than the base has, just keep the '../' prefix
      if (upCount >= baseSegments.length) {
        const remainingUpCount = upCount - baseSegments.length + 1;
        const upPrefix = Array(remainingUpCount).fill('..').join('/');
        finalPath = upPrefix + (finalPath ? `/${finalPath}` : '');
        // We'll return early since we've gone beyond the base
        return finalPath;
      }
      // Otherwise, adjust the base by removing the appropriate number of segments
      base = baseSegments.slice(0, baseSegments.length - upCount).join('/');
    }

    path = finalPath;
  }

  // Remove trailing slashes
  base = base.replace(/[/\\]+$/g, '');
  // Remove leading slashes
  path = path.replace(/^[/\\]+/g, '');

  // If path is empty, return base directly
  if (!path) return base;
  // If base is empty, return path directly
  if (!base) return path;

  // Join paths with forward slash while preserving backslashes
  return `${base}/${path}`;
};

function getMatcherString(id: string, resolutionBase: string | false | null | undefined) {
  if (resolutionBase === false || isAbsolute(id) || id.startsWith('**')) {
    return normalizePath(id);
  }

  // resolve('') is valid and will default to process.cwd()
  const basePath = normalizePath(resolve(resolutionBase || ''))
    // escape all possible (posix + win) path characters that might interfere with regex
    .replace(/[-^$*+?.()|[\]{}]/g, '\\$&');
  // Note that we use posix.join because:
  // 1. the basePath has been normalized to use /
  // 2. the incoming glob (id) matcher, also uses /
  // otherwise Node will force backslash (\) on windows
  // pathe `join` will normalize the \ to use /, which will make the regexp fail
  return joinPath(basePath, normalizePath(id));
}

const createFilter: CreateFilter = function createFilter(include?, exclude?, options?) {
  const resolutionBase = options && options.resolve;

  const getMatcher = (id: string | RegExp) =>
    id instanceof RegExp
      ? id
      : {
          test: (what: string) => {
            // this refactor is a tad overly verbose but makes for easy debugging
            const pattern = getMatcherString(id, resolutionBase);
            const fn = pm(pattern, { dot: true });
            const result = fn(what);

            return result;
          }
        };

  const includeMatchers = ensureArray(include).map(getMatcher);
  const excludeMatchers = ensureArray(exclude).map(getMatcher);

  if (!includeMatchers.length && !excludeMatchers.length)
    return (id) => typeof id === 'string' && !id.includes('\0');

  return function result(id: string | unknown): boolean {
    if (typeof id !== 'string') return false;
    if (id.includes('\0')) return false;

    const pathId = normalizePath(id);

    for (let i = 0; i < excludeMatchers.length; ++i) {
      const matcher = excludeMatchers[i];
      if (matcher instanceof RegExp) {
        matcher.lastIndex = 0;
      }
      if (matcher.test(pathId)) return false;
    }

    for (let i = 0; i < includeMatchers.length; ++i) {
      const matcher = includeMatchers[i];
      if (matcher instanceof RegExp) {
        matcher.lastIndex = 0;
      }
      if (matcher.test(pathId)) return true;
    }

    return !includeMatchers.length;
  };
};

export { createFilter as default };
