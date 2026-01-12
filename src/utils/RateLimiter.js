'use strict';

/**
 * @fileoverview Token bucket rate limiter implementation
 * @module utils/RateLimiter
 */

/**
 * Token bucket rate limiter for controlling operation frequency
 * @class RateLimiter
 */
class RateLimiter {
  /**
   * Creates a new RateLimiter
   * @param {Object} options - Configuration options
   * @param {number} options.tokensPerInterval - Number of tokens added per interval
   * @param {number} options.interval - Interval in milliseconds
   * @param {number} [options.maxTokens] - Maximum token bucket size (defaults to tokensPerInterval)
   */
  constructor(options) {
    const { tokensPerInterval, interval, maxTokens } = options;

    if (!Number.isInteger(tokensPerInterval) || tokensPerInterval <= 0) {
      throw new Error('tokensPerInterval must be a positive integer');
    }

    if (!Number.isInteger(interval) || interval <= 0) {
      throw new Error('interval must be a positive integer');
    }

    /**
     * Tokens added per interval
     * @type {number}
     * @private
     */
    this._tokensPerInterval = tokensPerInterval;

    /**
     * Interval in milliseconds
     * @type {number}
     * @private
     */
    this._interval = interval;

    /**
     * Maximum tokens in bucket
     * @type {number}
     * @private
     */
    this._maxTokens = maxTokens || tokensPerInterval;

    /**
     * Current token count
     * @type {number}
     * @private
     */
    this._tokens = this._maxTokens;

    /**
     * Last refill timestamp
     * @type {number}
     * @private
     */
    this._lastRefill = Date.now();
  }

  /**
   * Refills tokens based on elapsed time
   * @private
   */
  _refill() {
    const now = Date.now();
    const elapsed = now - this._lastRefill;
    const tokensToAdd = Math.floor(elapsed / this._interval) * this._tokensPerInterval;

    if (tokensToAdd > 0) {
      this._tokens = Math.min(this._maxTokens, this._tokens + tokensToAdd);
      this._lastRefill = now - (elapsed % this._interval);
    }
  }

  /**
   * Attempts to consume tokens
   * @param {number} [count=1] - Number of tokens to consume
   * @returns {boolean} True if tokens were consumed, false if insufficient
   */
  tryConsume(count = 1) {
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error('count must be a positive integer');
    }

    this._refill();

    if (this._tokens >= count) {
      this._tokens -= count;
      return true;
    }

    return false;
  }

  /**
   * Gets time until tokens are available
   * @param {number} [count=1] - Number of tokens needed
   * @returns {number} Time in milliseconds until tokens are available (0 if available now)
   */
  getTimeUntilNext(count = 1) {
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error('count must be a positive integer');
    }

    this._refill();

    if (this._tokens >= count) {
      return 0;
    }

    const tokensNeeded = count - this._tokens;
    const intervalsNeeded = Math.ceil(tokensNeeded / this._tokensPerInterval);

    const elapsed = Date.now() - this._lastRefill;
    const timeInCurrentInterval = this._interval - elapsed;

    return timeInCurrentInterval + (intervalsNeeded - 1) * this._interval;
  }

  /**
   * Waits until tokens are available, then consumes them
   * @param {number} [count=1] - Number of tokens to consume
   * @returns {Promise<void>} Resolves when tokens are consumed
   */
  async consume(count = 1) {
    const waitTime = this.getTimeUntilNext(count);

    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Re-check and consume (another consumer may have taken tokens)
    while (!this.tryConsume(count)) {
      const retryWait = this.getTimeUntilNext(count);
      await new Promise(resolve => setTimeout(resolve, retryWait || 1));
    }
  }

  /**
   * Gets the current number of available tokens
   * @returns {number} Available tokens
   */
  getAvailableTokens() {
    this._refill();
    return this._tokens;
  }

  /**
   * Resets the rate limiter to full capacity
   */
  reset() {
    this._tokens = this._maxTokens;
    this._lastRefill = Date.now();
  }

  /**
   * Gets rate limiter configuration
   * @returns {Object} Configuration object
   */
  getConfig() {
    return {
      tokensPerInterval: this._tokensPerInterval,
      interval: this._interval,
      maxTokens: this._maxTokens
    };
  }
}

/**
 * Creates a rate limiter with per-second rate
 * @param {number} requestsPerSecond - Maximum requests per second
 * @returns {RateLimiter} New rate limiter
 */
function perSecond(requestsPerSecond) {
  return new RateLimiter({
    tokensPerInterval: requestsPerSecond,
    interval: 1000
  });
}

/**
 * Creates a rate limiter with per-minute rate
 * @param {number} requestsPerMinute - Maximum requests per minute
 * @returns {RateLimiter} New rate limiter
 */
function perMinute(requestsPerMinute) {
  return new RateLimiter({
    tokensPerInterval: requestsPerMinute,
    interval: 60000
  });
}

module.exports = RateLimiter;
module.exports.perSecond = perSecond;
module.exports.perMinute = perMinute;
