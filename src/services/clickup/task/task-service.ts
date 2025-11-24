/**
 * SPDX-FileCopyrightText: © 2025 Talib Kareem <taazkareem@icloud.com>
 * SPDX-License-Identifier: MIT
 *
 * ClickUp Task Service
 * 
 * Main entry point for the ClickUp Task Service.
 * Combines all task-related functionality through inheritance:
 * - Core operations (CRUD)
 * - Search capabilities
 * - File attachments
 * - Comments
 * - Tags
 * - Custom fields
 */

import { TaskServiceCustomFields } from './task-custom-fields.js';
import { WorkspaceService } from '../workspace.js';

/**
 * Complete TaskService combining all task-related functionality
 */
export class TaskService extends TaskServiceCustomFields {
  constructor(
    apiKey: string,
    teamId: string,
    baseUrl?: string,
    workspaceService?: WorkspaceService
  ) {
    super(apiKey, teamId, baseUrl, workspaceService);
    this.logOperation('constructor', { initialized: true });
  }

  /**
   * Pre-warm frequently used task caches to speed up the first MCP calls
   * and reduce round-trips for common workspace-wide lookups.
   */
  async prewarmCaches(): Promise<void> {
    this.logOperation('prewarmCaches', { status: 'starting' });

    try {
      // Hydrate the workspace-wide task cache used by global name lookups
      const response = await this.getWorkspaceTasks({
        include_closed: true,
        detail_level: 'detailed'
      });

      const tasks = 'tasks' in response ? response.tasks : [];

      // Mirror the cache structure used in TaskServiceSearch.findTaskByNameGlobally
      if (!(this.constructor as any)._taskCache) {
        Object.defineProperty(this.constructor, '_taskCache', {
          value: {
            tasks: [],
            lastFetch: 0,
            cacheTTL: 60000,
          },
          writable: true
        });
      }

      const cache = (this.constructor as any)._taskCache;
      cache.tasks = tasks;
      cache.lastFetch = Date.now();

      this.logOperation('prewarmCaches', {
        status: 'completed',
        cachedTasks: tasks.length
      });
    } catch (error) {
      // Cache warm-up should never block server startup
      this.logOperation('prewarmCaches', {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}