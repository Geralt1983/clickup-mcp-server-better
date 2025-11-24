/**
 * SPDX-FileCopyrightText: © 2025 Talib Kareem <taazkareem@icloud.com>
 * SPDX-License-Identifier: MIT
 *
 * Shared Services Module
 * 
 * This module maintains singleton instances of services that should be shared
 * across the application to ensure consistent state.
 */

import { createClickUpServices, ClickUpServices } from './clickup/index.js';
import config from '../config.js';
import { Logger } from '../logger.js';

const logger = new Logger('SharedServices');

// Singleton instances
let clickUpServicesInstance: ClickUpServices | null = null;
let prewarmPromise: Promise<void> | null = null;

/**
 * Get or create the ClickUp services instance
 */
function getClickUpServices(): ClickUpServices {
  if (!clickUpServicesInstance) {
    logger.info('Creating shared ClickUp services singleton');
    
    // Create the services instance
    clickUpServicesInstance = createClickUpServices({
      apiKey: config.clickupApiKey,
      teamId: config.clickupTeamId
    });
    
    // Log what services were initialized with more clarity
    logger.info('Services initialization complete', { 
      services: Object.keys(clickUpServicesInstance).join(', '),
      teamId: config.clickupTeamId
    });
  }
  return clickUpServicesInstance;
}

// Create a single instance of ClickUp services to be shared
export const clickUpServices = getClickUpServices();

// Export individual services for convenience
export const {
  list: listService,
  task: taskService,
  folder: folderService,
  workspace: workspaceService,
  timeTracking: timeTrackingService,
  document: documentService,
  custom: customRequestService
} = clickUpServices;

/**
 * Prewarm shared ClickUp service caches to reduce latency for the first
 * MCP calls. This runs once per process and logs but never throws.
 */
export async function prewarmClickUpCaches(): Promise<void> {
  if (prewarmPromise) {
    return prewarmPromise;
  }

  prewarmPromise = (async () => {
    logger.info('Starting background ClickUp cache prewarm');

    await Promise.allSettled([
      workspaceService.prewarmCaches(),
      taskService.prewarmCaches?.()
    ]);

    logger.info('Completed ClickUp cache prewarm');
  })();

  return prewarmPromise;
}
