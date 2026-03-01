'use strict';

/**
 * @fileoverview Retry utilities with exponential backoff
 * @module utils/retry
 */

/**
 * Default retry options
 * @constant {any}
 */
const DEFAULT_OPTIONS = {
  maxRetries: 3,
  initialDelay: 100,
  maxDelay: 10000,
  factor: 2,
  jitter: true,
  shouldRetry: () => true
};

/**
 * Calculates delay with optional jitter
 * @param {number} attempt - Current attempt number (0-based)
 * @param {any} options - Retry options
 * @returns {number} Delay in milliseconds
 * @private
 */
function calculateDelay(attempt, options) {
  const { initialDelay, maxDelay, factor, jitter } = options;

  // Exponential backoff
  let delay = initialDelay * Math.pow(factor, attempt);

  // Cap at max delay
  delay = Math.min(delay, maxDelay);

  // Add jitter (0 to 100% of delay)
  if (jitter) {
    delay = delay * (0.5 + Math.random());
  }

  return Math.floor(delay);
}

/**
 * Retries an async function with exponential backoff
 * @template T
 * @param {function(): Promise<T>} fn - Async function to retry
 * @param {any} [options] - Retry options   *
 * @param {object} options
 * @param {function(Error, number): boolean} [options.shouldRetry] - Predicate to determine if should retry
 * @param {object} options
 * @param {function(Error, number): void} [options.onRetry] - Callback on each retry
 * @returns {Promise<T>} Result of the function
 * @throws {Error} Last error if all retries fail
 */
async function retry(fn, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { maxRetries, shouldRetry, onRetry } = opts;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (/** @type {any} */ error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }

      // Calculate delay
      const delay = calculateDelay(attempt, opts);

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(error, attempt);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Creates a retryable version of an async function
 * @template T
 * @param {function(...*): Promise<T>} fn - Async function to wrap
 * @param {any} [options] - Retry options
 * @returns {function(...*): Promise<T>} Wrapped function with retry logic
 */
function retryable(fn, options = {}) {
  return function retryableFn(...args) {
    // @ts-ignore
    return retry(() => fn.apply(this, args), options);
  };
}

/**
 * Retry predicate that retries on specific error types
 * @param {Array<Function>} errorTypes - Error constructors to retry on
 * @returns {function(Error): boolean} Predicate function
 */
function retryOn(errorTypes) {
  return (/** @type {any} */ error) => {
    return errorTypes.some(ErrorType => error instanceof ErrorType);
  };
}

/**
 * Retry predicate that does not retry on specific error types
 * @param {Array<Function>} errorTypes - Error constructors to not retry on
 * @returns {function(Error): boolean} Predicate function
 */
function retryExcept(errorTypes) {
  return (/** @type {any} */ error) => {
    return !errorTypes.some(ErrorType => error instanceof ErrorType);
  };
}

/**
 * Retry predicate that retries on specific error codes
 * @param {Array<string>} codes - Error codes to retry on
 * @returns {function(Error): boolean} Predicate function
 */
function retryOnCodes(codes) {
  return (/** @type {any} */ error) => {
    return error.code && codes.includes(error.code);
  };
}

module.exports = {
  retry,
  retryable,
  retryOn,
  retryExcept,
  retryOnCodes,
  DEFAULT_OPTIONS
};
