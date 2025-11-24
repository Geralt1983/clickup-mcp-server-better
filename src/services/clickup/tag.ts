/**
 * SPDX-FileCopyrightText: © 2025 Talib Kareem <taazkareem@icloud.com>
 * SPDX-License-Identifier: MIT
 *
 * ClickUp Tag Service
 * 
 * Provides access to ClickUp API endpoints for tag management:
 * - Space tags (get, create, update, delete)
 * - Task tags (add, remove)
 */

import { BaseClickUpService, ServiceResponse } from './base.js';
import { ClickUpTag, CreateSpaceTagData, SpaceTagsResponse, UpdateSpaceTagData } from './types.js';

/**
 * ClickUp Tag Service class for managing tags
 */
export class ClickUpTagService extends BaseClickUpService {
  /**
   * Get all tags in a space
   * @param spaceId - ID of the space to get tags from
   * @returns Promise with tags array
   */
  async getSpaceTags(spaceId: string): Promise<ServiceResponse<ClickUpTag[]>> {
    try {
      this.logger.debug(`Getting tags for space: ${spaceId}`);
      
      const response = await this.client.get<SpaceTagsResponse>(`/space/${spaceId}/tag`);
      
      return {
        success: true,
        data: response.data.tags
      };
    } catch (error) {
      this.logger.error(`Failed to get tags for space: ${spaceId}`, error);
      return {
        success: false,
        error: {
          message: error.message || 'Failed to get space tags',
          code: error.code,
          details: error.data
        }
      };
    }
  }

  /**
   * Create a new tag in a space
   * @param spaceId - ID of the space
   * @param tagData - Tag data (name, background color, foreground color)
   * @returns Promise with created tag
   */
  async createSpaceTag(
    spaceId: string, 
    tagData: CreateSpaceTagData
  ): Promise<ServiceResponse<ClickUpTag>> {
    try {
      this.logger.debug(`Creating tag "${tagData.tag_name}" in space: ${spaceId}`);
      
      // Send tag data wrapped in a 'tag' object
      const response = await this.client.post<{ tag: ClickUpTag }>(
        `/space/${spaceId}/tag`,
        {
          tag: {
            name: tagData.tag_name,
            tag_bg: tagData.tag_bg,
            tag_fg: tagData.tag_fg
          }
        }
      );
      
      return {
        success: true,
        data: response.data.tag
      };
    } catch (error) {
      this.logger.error(`Failed to create tag in space: ${spaceId}`, error);
      return {
        success: false,
        error: {
          message: error.message || 'Failed to create space tag',
          code: error.code,
          details: error.data
        }
      };
    }
  }

  /**
   * Update an existing tag in a space
   * @param spaceId - ID of the space
   * @param tagName - Current name of the tag to update
   * @param updateData - Tag data to update (name, colors)
   * @returns Promise with updated tag
   */
  async updateSpaceTag(
    spaceId: string,
    tagName: string,
    updateData: UpdateSpaceTagData
  ): Promise<ServiceResponse<ClickUpTag>> {
    try {
      this.logger.debug(`Updating tag "${tagName}" in space: ${spaceId}`);
      
      // Encode the tag name in the URL
      const encodedTagName = encodeURIComponent(tagName);
      
      const response = await this.client.put<{ tag: ClickUpTag }>(
        `/space/${spaceId}/tag/${encodedTagName}`,
        updateData
      );
      
      return {
        success: true,
        data: response.data.tag
      };
    } catch (error) {
      this.logger.error(`Failed to update tag "${tagName}" in space: ${spaceId}`, error);
      return {
        success: false,
        error: {
          message: error.message || 'Failed to update space tag',
          code: error.code,
          details: error.data
        }
      };
    }
  }

  /**
   * Delete a tag from a space
   * @param spaceId - ID of the space
   * @param tagName - Name of the tag to delete
   * @returns Promise with success status
   */
  async deleteSpaceTag(
    spaceId: string,
    tagName: string
  ): Promise<ServiceResponse<void>> {
    try {
      this.logger.debug(`Deleting tag "${tagName}" from space: ${spaceId}`);
      
      // Encode the tag name in the URL
      const encodedTagName = encodeURIComponent(tagName);
      
      await this.client.delete(`/space/${spaceId}/tag/${encodedTagName}`);
      
      return {
        success: true
      };
    } catch (error) {
      this.logger.error(`Failed to delete tag "${tagName}" from space: ${spaceId}`, error);
      return {
        success: false,
        error: {
          message: error.message || 'Failed to delete space tag',
          code: error.code,
          details: error.data
        }
      };
    }
  }

  /**
   * Add a tag to a task
   * @param taskId - ID of the task
   * @param tagName - Name of the tag to add
   * @returns Promise with success status and tag data
   */
  async addTagToTask(
    taskId: string,
    tagName: string
  ): Promise<ServiceResponse<{ tagAdded: boolean }>> {
    try {
      this.logger.debug(`Adding tag "${tagName}" to task: ${taskId}`);

      // Some workspaces experience slower responses for tag operations
      // Give this path a more generous timeout to avoid premature failures
      const tagOperationTimeout = Math.max(this.timeout, 90000);
      
      // First get the task to get its space ID
      const taskResponse = await this.client.get<any>(`/task/${taskId}`, {
        timeout: tagOperationTimeout
      });
      if (!taskResponse.data?.space?.id) {
        return {
          success: false,
          error: {
            message: 'Could not determine space ID from task',
            code: 'SPACE_NOT_FOUND'
          }
        };
      }

      // Get space tags to verify tag exists
      const spaceId = taskResponse.data.space.id;
      const spaceTags = await this.getSpaceTags(spaceId);
      
      if (!spaceTags.success || !spaceTags.data) {
        return {
          success: false,
          error: {
            message: 'Failed to verify tag existence in space',
            code: 'TAG_VERIFICATION_FAILED',
            details: spaceTags.error
          }
        };
      }

      // Check if tag exists
      const tagExists = spaceTags.data.some(tag => tag.name === tagName);
      if (!tagExists) {
        return {
          success: false,
          error: {
            message: `Tag "${tagName}" does not exist in the space`,
            code: 'TAG_NOT_FOUND'
          }
        };
      }

      // Encode the tag name in the URL
      const encodedTagName = encodeURIComponent(tagName);
      
      // Add the tag
      await this.client.post(
        `/task/${taskId}/tag/${encodedTagName}`,
        {},
        { timeout: tagOperationTimeout }
      );
      
      // Verify the tag was added by getting the task again
      const verifyResponse = await this.client.get<any>(`/task/${taskId}`, {
        timeout: tagOperationTimeout
      });
      const tagAdded = verifyResponse.data?.tags?.some(tag => tag.name === tagName) ?? false;

      if (!tagAdded) {
        return {
          success: false,
          error: {
            message: 'Tag addition failed verification',
            code: 'TAG_VERIFICATION_FAILED'
          }
        };
      }
      
      return {
        success: true,
        data: { tagAdded: true }
      };
    } catch (error) {
      // Capture raw response details to help diagnose ClickUp issues
      const status = error?.response?.status ?? error?.data?.response?.status;
      const responseData = error?.response?.data ?? error?.data?.response?.data ?? error?.data;

      this.logger.error(
        `Failed to add tag "${tagName}" to task: ${taskId}`,
        {
          error,
          status,
          responseData
        }
      );
      return {
        success: false,
        error: {
          message: error.message || 'Failed to add tag to task',
          code: error.code,
          details: error.data
        }
      };
    }
  }

  /**
   * Remove a tag from a task
   * @param taskId - ID of the task
   * @param tagName - Name of the tag to remove
   * @returns Promise with success status
   */
  async removeTagFromTask(
    taskId: string,
    tagName: string
  ): Promise<ServiceResponse<void>> {
    try {
      this.logger.debug(`Removing tag "${tagName}" from task: ${taskId}`);
      
      // Encode the tag name in the URL
      const encodedTagName = encodeURIComponent(tagName);
      
      await this.client.delete(`/task/${taskId}/tag/${encodedTagName}`);
      
      return {
        success: true
      };
    } catch (error) {
      this.logger.error(`Failed to remove tag "${tagName}" from task: ${taskId}`, error);
      return {
        success: false,
        error: {
          message: error.message || 'Failed to remove tag from task',
          code: error.code,
          details: error.data
        }
      };
    }
  }
} 