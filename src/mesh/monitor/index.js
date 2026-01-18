'use strict';

/**
 * @fileoverview Monitor module exports
 * @module mesh/monitor
 */

const { NetworkMonitor, HEALTH_STATUS, DEFAULT_CONFIG } = require('./NetworkMonitor');

module.exports = {
    NetworkMonitor,
    HEALTH_STATUS,
    DEFAULT_CONFIG,
};
