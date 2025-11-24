/**
 * SPDX-FileCopyrightText: © 2025 Talib Kareem <taazkareem@icloud.com>
 * SPDX-License-Identifier: MIT
 *
 * ClickUp Tag Tools
 * 
 * Provides tools for managing tags in ClickUp:
 * - Get space tags
 * - Create, update, delete space tags
 * - Add/remove tags to/from tasks
 */

import { ErrorCode, ServiceResponse } from '../services/clickup/base.js';
import { clickUpServices } from '../services/shared.js';
import { Logger } from '../logger.js';
import { sponsorService } from '../utils/sponsor-service.js';
import { ClickUpTag } from '../services/clickup/types.js';
import { processColorCommand } from '../utils/color-processor.js';
import { validateTaskIdentification } from './task/utilities.js';

// Create a logger specific to tag tools
const logger = new Logger('TagTools');

// Use shared services instance
const { task: taskService } = clickUpServices;

//=============================================================================
// TOOL DEFINITIONS
//=============================================================================

/**
 * Tool definition for getting space tags
 */
export const getSpaceTagsTool = {
  name: "get_space_tags",
  description: `Gets all tags in a ClickUp space. Use spaceId (preferred) or spaceName. Tags are defined at space level - check available tags before adding to tasks.`,
  inputSchema: {
    type: "object",
    properties: {
      spaceId: {
        type: "string",
        description: "ID of the space to get tags from. Use this instead of spaceName if you have the ID."
      },
      spaceName: {
        type: "string",
        description: "Name of the space to get tags from. Only use if you don't have spaceId."
      }
    }
  }
};

/**
 * Tool definition for creating a tag in a space
 */
export const createSpaceTagTool = {
  name: "create_space_tag",
  description: `Purpose: Create a new tag in a ClickUp space.

Valid Usage:
1. Provide spaceId (preferred if available)
2. Provide spaceName (will be resolved to a space ID)

Requirements:
- tagName: REQUIRED
- EITHER spaceId OR spaceName: REQUIRED

Notes:
- New tag will be available for all tasks in the space
- You can specify background and foreground colors in HEX format (e.g., #FF0000)
- You can also provide a color command (e.g., "blue tag") to automatically generate colors
- After creating a tag, you can add it to tasks using add_tag_to_task`,
  inputSchema: {
    type: "object",
    properties: {
      spaceId: {
        type: "string",
        description: "ID of the space to create tag in. Use this instead of spaceName if you have the ID."
      },
      spaceName: {
        type: "string",
        description: "Name of the space to create tag in. Only use if you don't have spaceId."
      },
      tagName: {
        type: "string",
        description: "Name of the tag to create."
      },
      tagBg: {
        type: "string",
        description: "Background color for the tag in HEX format (e.g., #FF0000). Defaults to #000000 (black)."
      },
      tagFg: {
        type: "string",
        description: "Foreground (text) color for the tag in HEX format (e.g., #FFFFFF). Defaults to #FFFFFF (white)."
      },
      colorCommand: {
        type: "string",
        description: "Natural language color command (e.g., 'blue tag', 'dark red background'). When provided, this will override tagBg and tagFg with automatically generated values."
      }
    },
    required: ["tagName"]
  }
};

/**
 * Tool definition for updating a tag in a space
 */
export const updateSpaceTagTool = {
  name: "update_space_tag",
  description: `Purpose: Update an existing tag in a ClickUp space.

Valid Usage:
1. Provide spaceId (preferred if available)
2. Provide spaceName (will be resolved to a space ID)

Requirements:
- tagName: REQUIRED
- EITHER spaceId OR spaceName: REQUIRED
- At least one of newTagName, tagBg, tagFg, or colorCommand must be provided

Notes:
- Changes to the tag will apply to all tasks in the space that use this tag
- You can provide a color command (e.g., "blue tag") to automatically generate colors
- You cannot partially update a tag - provide all properties you want to keep`,
  inputSchema: {
    type: "object",
    properties: {
      spaceId: {
        type: "string",
        description: "ID of the space containing the tag. Use this instead of spaceName if you have the ID."
      },
      spaceName: {
        type: "string",
        description: "Name of the space containing the tag. Only use if you don't have spaceId."
      },
      tagName: {
        type: "string",
        description: "Current name of the tag to update."
      },
      newTagName: {
        type: "string",
        description: "New name for the tag."
      },
      tagBg: {
        type: "string",
        description: "New background color for the tag in HEX format (e.g., #FF0000)."
      },
      tagFg: {
        type: "string",
        description: "New foreground (text) color for the tag in HEX format (e.g., #FFFFFF)."
      },
      colorCommand: {
        type: "string",
        description: "Natural language color command (e.g., 'blue tag', 'dark red background'). When provided, this will override tagBg and tagFg with automatically generated values."
      }
    },
    required: ["tagName"]
  }
};

/**
 * Tool definition for deleting a tag in a space
 */
export const deleteSpaceTagTool = {
  name: "delete_space_tag",
  description: `Purpose: Delete a tag from a ClickUp space.

Valid Usage:
1. Provide spaceId (preferred if available)
2. Provide spaceName (will be resolved to a space ID)

Requirements:
- tagName: REQUIRED
- EITHER spaceId OR spaceName: REQUIRED

Warning:
- This will remove the tag from all tasks in the space
- This action cannot be undone`,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
  },
  inputSchema: {
    type: "object",
    properties: {
      spaceId: {
        type: "string",
        description: "ID of the space containing the tag. Use this instead of spaceName if you have the ID."
      },
      spaceName: {
        type: "string",
        description: "Name of the space containing the tag. Only use if you don't have spaceId."
      },
      tagName: {
        type: "string",
        description: "Name of the tag to delete."
      }
    },
    required: ["tagName"]
  }
};

/**
 * Tool definition for adding a tag to a task
 */
export const addTagToTaskTool = {
  name: "add_tag_to_task",
  description: `Adds existing tag to task. Use taskId (preferred) or taskName + optional listName. Tag must exist in space (use get_space_tags to verify, create_space_tag if needed). WARNING: Will fail if tag doesn't exist.`,
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "ID of the task to add tag to. Works with both regular task IDs (9 characters) and custom IDs with uppercase prefixes (like 'DEV-1234')."
      },
      customTaskId: {
        type: "string",
        description: "Custom task ID (e.g., 'DEV-1234'). Only use if you want to explicitly force custom ID lookup. In most cases, use taskId which auto-detects ID format."
      },
      taskName: {
        type: "string",
        description: "Name of the task to add tag to. Will search across all lists unless listName is provided."
      },
      listName: {
        type: "string",
        description: "Optional: Name of the list containing the task. Use to disambiguate when multiple tasks have the same name."
      },
      tagName: {
        type: "string",
        description: "Name of the tag to add to the task. The tag must already exist in the space."
      }
    },
    required: ["tagName"]
  }
};

/**
 * Tool definition for removing a tag from a task
 */
export const removeTagFromTaskTool = {
  name: "remove_tag_from_task",
  description: `Removes tag from task. Use taskId (preferred) or taskName + optional listName. Only removes tag-task association, tag remains in space. For multiple tasks, provide listName to disambiguate.`,
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "ID of the task to remove tag from. Works with both regular task IDs (9 characters) and custom IDs with uppercase prefixes (like 'DEV-1234')."
      },
      customTaskId: {
        type: "string",
        description: "Custom task ID (e.g., 'DEV-1234'). Only use if you want to explicitly force custom ID lookup. In most cases, use taskId which auto-detects ID format."
      },
      taskName: {
        type: "string",
        description: "Name of the task to remove tag from. Will search across all lists unless listName is provided."
      },
      listName: {
        type: "string",
        description: "Optional: Name of the list containing the task. Use to disambiguate when multiple tasks have the same name."
      },
      tagName: {
        type: "string",
        description: "Name of the tag to remove from the task."
      }
    },
    required: ["tagName"]
  }
};

//=============================================================================
// HANDLER WRAPPER UTILITY
//=============================================================================

/**
 * Creates a wrapped handler function with standard error handling and response formatting
 */
function createHandlerWrapper<T>(
  handler: (params: any) => Promise<T>,
  formatResponse: (result: T) => any = (result) => result
) {
  return async (params: any) => {
    try {
      logger.debug('Handler called with params', { params });
      
      // Call the handler
      const result = await handler(params);
      
      // Format the result for response
      const formattedResult = formatResponse(result);
      
      // Use the sponsor service to create the formatted response
      return sponsorService.createResponse(formattedResult, true);
    } catch (error: any) {
      // Log the error
      logger.error('Error in handler', { error: error.message, code: error.code });
      
      // Format and return the error using sponsor service
      return sponsorService.createErrorResponse(error, params);
    }
  };
}

//=============================================================================
// TAG TOOL HANDLERS
//=============================================================================

/**
 * Wrapper for getSpaceTags handler
 */
export const handleGetSpaceTags = createHandlerWrapper(
  getSpaceTags,
  (tags: ClickUpTag[]) => ({
    tags: tags || [],
    count: Array.isArray(tags) ? tags.length : 0
  })
);

/**
 * Wrapper for createSpaceTag handler
 */
export const handleCreateSpaceTag = createHandlerWrapper(createSpaceTag);

/**
 * Wrapper for updateSpaceTag handler
 */
export const handleUpdateSpaceTag = createHandlerWrapper(updateSpaceTag);

/**
 * Wrapper for deleteSpaceTag handler
 */
export const handleDeleteSpaceTag = createHandlerWrapper(deleteSpaceTag, () => ({
  success: true,
  message: "Tag deleted successfully"
}));

/**
 * Wrapper for addTagToTask handler
 */
export const handleAddTagToTask = createHandlerWrapper(addTagToTask, (result) => {
  if (!result.success) {
    return {
      success: false,
      error: result.error
    };
  }
  return {
    success: true,
    message: "Tag added to task successfully"
  };
});

/**
 * Wrapper for removeTagFromTask handler
 */
export const handleRemoveTagFromTask = createHandlerWrapper(removeTagFromTask, () => ({
  success: true,
  message: "Tag removed from task successfully"
}));

//=============================================================================
// TOOL DEFINITIONS AND HANDLERS EXPORT
//=============================================================================

// Tool definitions with their handler mappings
export const tagTools = [
  { definition: getSpaceTagsTool, handler: handleGetSpaceTags },
  { definition: createSpaceTagTool, handler: handleCreateSpaceTag },
  { definition: updateSpaceTagTool, handler: handleUpdateSpaceTag },
  { definition: deleteSpaceTagTool, handler: handleDeleteSpaceTag },
  { definition: addTagToTaskTool, handler: handleAddTagToTask },
  { definition: removeTagFromTaskTool, handler: handleRemoveTagFromTask }
];

/**
 * Get all tags in a space
 * @param params - Space identifier (id or name)
 * @returns Tags in the space
 */
export async function getSpaceTags(params: {
  spaceId?: string;
  spaceName?: string;
}): Promise<ClickUpTag[]> {
  const { spaceId, spaceName } = params;
  
  if (!spaceId && !spaceName) {
    logger.error('getSpaceTags called without required parameters');
    throw new Error('Either spaceId or spaceName is required');
  }

  logger.info('Getting tags for space', { spaceId, spaceName });
  
  try {
    // If spaceName is provided, we need to resolve it to an ID
    let resolvedSpaceId = spaceId;
    if (!resolvedSpaceId && spaceName) {
      logger.debug(`Resolving space name: ${spaceName}`);
      
      const spaces = await clickUpServices.workspace.getSpaces();
      
      const space = spaces.find(s => 
        s.name.toLowerCase() === spaceName.toLowerCase()
      );
      
      if (!space) {
        logger.error(`Space not found: ${spaceName}`);
        throw new Error(`Space not found: ${spaceName}`);
      }
      
      resolvedSpaceId = space.id;
    }
    
    // Get tags from the space
    const tagsResponse = await clickUpServices.tag.getSpaceTags(resolvedSpaceId);
    
    if (!tagsResponse.success) {
      logger.error('Failed to get space tags', tagsResponse.error);
      throw new Error(tagsResponse.error?.message || 'Failed to get space tags');
    }
    
    logger.info(`Successfully retrieved ${tagsResponse.data?.length || 0} tags`);
    
    return tagsResponse.data || [];
  } catch (error) {
    logger.error('Error in getSpaceTags', error);
    throw error;
  }
}

/**
 * Create a new tag in a space
 * @param params - Space identifier and tag details
 * @returns Created tag
 */
export async function createSpaceTag(params: {
  spaceId?: string;
  spaceName?: string;
  tagName: string;
  tagBg?: string;
  tagFg?: string;
  colorCommand?: string;
}) {
  let { spaceId, spaceName, tagName, tagBg = '#000000', tagFg = '#ffffff', colorCommand } = params;
  
  // Process color command if provided
  if (colorCommand) {
    const colors = processColorCommand(colorCommand);
    if (colors) {
      tagBg = colors.background;
      tagFg = colors.foreground;
      logger.info(`Processed color command: "${colorCommand}" → BG: ${tagBg}, FG: ${tagFg}`);
    } else {
      logger.warn(`Could not process color command: "${colorCommand}". Using default colors.`);
    }
  }
  
  if (!tagName) {
    logger.error('createSpaceTag called without tagName');
    return {
      success: false,
      error: {
        message: 'tagName is required'
      }
    };
  }
  
  if (!spaceId && !spaceName) {
    logger.error('createSpaceTag called without space identifier');
    return {
      success: false,
      error: {
        message: 'Either spaceId or spaceName is required'
      }
    };
  }

  logger.info('Creating tag in space', { spaceId, spaceName, tagName, tagBg, tagFg });
  
  try {
    // If spaceName is provided, we need to resolve it to an ID
    let resolvedSpaceId = spaceId;
    if (!resolvedSpaceId && spaceName) {
      logger.debug(`Resolving space name: ${spaceName}`);
      
      const spaces = await clickUpServices.workspace.getSpaces();
      
      const space = spaces.find(s => 
        s.name.toLowerCase() === spaceName.toLowerCase()
      );
      
      if (!space) {
        logger.error(`Space not found: ${spaceName}`);
        return {
          success: false,
          error: {
            message: `Space not found: ${spaceName}`
          }
        };
      }
      
      resolvedSpaceId = space.id;
    }
    
    // Create tag in the space
    const tagResponse = await clickUpServices.tag.createSpaceTag(resolvedSpaceId, {
      tag_name: tagName,
      tag_bg: tagBg,
      tag_fg: tagFg
    });
    
    if (!tagResponse.success) {
      logger.error('Failed to create space tag', tagResponse.error);
      return {
        success: false,
        error: tagResponse.error || {
          message: 'Failed to create space tag'
        }
      };
    }
    
    logger.info(`Successfully created tag: ${tagName}`);
    
    return {
      success: true,
      data: tagResponse.data
    };
  } catch (error) {
    logger.error('Error in createSpaceTag', error);
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
 * @param params - Space identifier, tag name, and updated properties
 * @returns Updated tag
 */
export async function updateSpaceTag(params: {
  spaceId?: string;
  spaceName?: string;
  tagName: string;
  newTagName?: string;
  tagBg?: string;
  tagFg?: string;
  colorCommand?: string;
}) {
  const { spaceId, spaceName, tagName, newTagName, colorCommand } = params;
  let { tagBg, tagFg } = params;
  
  // Process color command if provided
  if (colorCommand) {
    const colors = processColorCommand(colorCommand);
    if (colors) {
      tagBg = colors.background;
      tagFg = colors.foreground;
      logger.info(`Processed color command: "${colorCommand}" → BG: ${tagBg}, FG: ${tagFg}`);
    } else {
      logger.warn(`Could not process color command: "${colorCommand}". Using default colors.`);
    }
  }
  
  if (!tagName) {
    logger.error('updateSpaceTag called without tagName');
    return {
      success: false,
      error: {
        message: 'tagName is required'
      }
    };
  }
  
  if (!spaceId && !spaceName) {
    logger.error('updateSpaceTag called without space identifier');
    return {
      success: false,
      error: {
        message: 'Either spaceId or spaceName is required'
      }
    };
  }
  
  // Make sure there's at least one property to update
  if (!newTagName && !tagBg && !tagFg && !colorCommand) {
    logger.error('updateSpaceTag called without properties to update');
    return {
      success: false,
      error: {
        message: 'At least one property (newTagName, tagBg, tagFg, or colorCommand) must be provided'
      }
    };
  }

  logger.info('Updating tag in space', { spaceId, spaceName, tagName, newTagName, tagBg, tagFg });
  
  try {
    // If spaceName is provided, we need to resolve it to an ID
    let resolvedSpaceId = spaceId;
    if (!resolvedSpaceId && spaceName) {
      logger.debug(`Resolving space name: ${spaceName}`);
      
      const spaces = await clickUpServices.workspace.getSpaces();
      
      const space = spaces.find(s => 
        s.name.toLowerCase() === spaceName.toLowerCase()
      );
      
      if (!space) {
        logger.error(`Space not found: ${spaceName}`);
        return {
          success: false,
          error: {
            message: `Space not found: ${spaceName}`
          }
        };
      }
      
      resolvedSpaceId = space.id;
    }
    
    // Prepare update data
    const updateData: {
      tag_name?: string;
      tag_bg?: string;
      tag_fg?: string;
    } = {};
    
    if (newTagName) updateData.tag_name = newTagName;
    if (tagBg) updateData.tag_bg = tagBg;
    if (tagFg) updateData.tag_fg = tagFg;
    
    // Update tag in the space
    const tagResponse = await clickUpServices.tag.updateSpaceTag(resolvedSpaceId, tagName, updateData);
    
    if (!tagResponse.success) {
      logger.error('Failed to update space tag', tagResponse.error);
      return {
        success: false,
        error: tagResponse.error || {
          message: 'Failed to update space tag'
        }
      };
    }
    
    logger.info(`Successfully updated tag: ${tagName}`);
    
    return {
      success: true,
      data: tagResponse.data
    };
  } catch (error) {
    logger.error('Error in updateSpaceTag', error);
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
 * @param params - Space identifier and tag name
 * @returns Success status
 */
export async function deleteSpaceTag(params: {
  spaceId?: string;
  spaceName?: string;
  tagName: string;
}) {
  const { spaceId, spaceName, tagName } = params;
  
  if (!tagName) {
    logger.error('deleteSpaceTag called without tagName');
    return {
      success: false,
      error: {
        message: 'tagName is required'
      }
    };
  }
  
  if (!spaceId && !spaceName) {
    logger.error('deleteSpaceTag called without space identifier');
    return {
      success: false,
      error: {
        message: 'Either spaceId or spaceName is required'
      }
    };
  }

  logger.info('Deleting tag from space', { spaceId, spaceName, tagName });
  
  try {
    // If spaceName is provided, we need to resolve it to an ID
    let resolvedSpaceId = spaceId;
    if (!resolvedSpaceId && spaceName) {
      logger.debug(`Resolving space name: ${spaceName}`);
      
      const spaces = await clickUpServices.workspace.getSpaces();
      
      const space = spaces.find(s => 
        s.name.toLowerCase() === spaceName.toLowerCase()
      );
      
      if (!space) {
        logger.error(`Space not found: ${spaceName}`);
        return {
          success: false,
          error: {
            message: `Space not found: ${spaceName}`
          }
        };
      }
      
      resolvedSpaceId = space.id;
    }
    
    // Delete tag from the space
    const tagResponse = await clickUpServices.tag.deleteSpaceTag(resolvedSpaceId, tagName);
    
    if (!tagResponse.success) {
      logger.error('Failed to delete space tag', tagResponse.error);
      return {
        success: false,
        error: tagResponse.error || {
          message: 'Failed to delete space tag'
        }
      };
    }
    
    logger.info(`Successfully deleted tag: ${tagName}`);
    
    return {
      success: true
    };
  } catch (error) {
    logger.error('Error in deleteSpaceTag', error);
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
 * Simple task ID resolver
 */
async function resolveTaskId(params: {
  taskId?: string;
  customTaskId?: string;
  taskName?: string;
  listName?: string;
}): Promise<{ success: boolean; taskId?: string; error?: any }> {
  const { taskId, customTaskId, taskName, listName } = params;
  
  try {
    // First validate task identification with global lookup enabled
    const validationResult = validateTaskIdentification(
      { taskId, customTaskId, taskName, listName },
      { useGlobalLookup: true }
    );

    if (!validationResult.isValid) {
      return {
        success: false,
        error: { message: validationResult.errorMessage }
      };
    }

    const result = await taskService.findTasks({
      taskId,
      customTaskId,
      taskName,
      listName,
      allowMultipleMatches: false,
      useSmartDisambiguation: true,
      includeFullDetails: false
    });

    if (!result || Array.isArray(result)) {
      return {
        success: false,
        error: { message: 'Task not found with the provided identification' }
      };
    }

    return { success: true, taskId: result.id };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error.message || 'Failed to resolve task ID',
        code: error.code,
        details: error.data
      }
    };
  }
}

/**
 * Add a tag to a task
 * @param params - Task identifier and tag name
 * @returns Success status
 */
export async function addTagToTask(params: {
  taskId?: string;
  customTaskId?: string;
  taskName?: string;
  listName?: string;
  tagName: string;
}) {
  const { taskId, customTaskId, taskName, listName, tagName } = params;
  
  if (!tagName) {
    logger.error('addTagToTask called without tagName');
    return {
      success: false,
      error: {
        message: 'tagName is required'
      }
    };
  }
  
  if (!taskId && !customTaskId && !taskName) {
    logger.error('addTagToTask called without task identifier');
    return {
      success: false,
      error: {
        message: 'Either taskId, customTaskId, or taskName is required'
      }
    };
  }

  logger.info('Adding tag to task', { taskId, customTaskId, taskName, listName, tagName });
  
  try {
    // Resolve the task ID
    const taskIdResult = await resolveTaskId({ taskId, customTaskId, taskName, listName });
    
    if (!taskIdResult.success) {
      return {
        success: false,
        error: taskIdResult.error
      };
    }
    
    // Add tag to the task
    const result = await clickUpServices.tag.addTagToTask(taskIdResult.taskId, tagName);
    
    if (!result.success) {
      logger.error('Failed to add tag to task', result.error);
      
      // Provide more specific error messages based on error code
      if (result.error?.code === 'TAG_NOT_FOUND') {
        return {
          success: false,
          error: {
            message: `The tag "${tagName}" does not exist in the space. Please create it first using create_space_tag.`
          }
        };
      } else if (result.error?.code === 'SPACE_NOT_FOUND') {
        return {
          success: false,
          error: {
            message: 'Could not determine which space the task belongs to.'
          }
        };
      } else if (result.error?.code === 'TAG_VERIFICATION_FAILED') {
        return {
          success: false,
          error: {
            message: 'The tag addition could not be verified. Please check if the tag was added manually.'
          }
        };
      }
      
      return {
        success: false,
        error: result.error || {
          message: 'Failed to add tag to task'
        }
      };
    }
    
    logger.info(`Successfully added tag "${tagName}" to task ${taskIdResult.taskId}`);
    
    return {
      success: true
    };
  } catch (error) {
    logger.error('Error in addTagToTask', error);
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
 * @param params - Task identifier and tag name
 * @returns Success status
 */
export async function removeTagFromTask(params: {
  taskId?: string;
  customTaskId?: string;
  taskName?: string;
  listName?: string;
  tagName: string;
}) {
  const { taskId, customTaskId, taskName, listName, tagName } = params;
  
  if (!tagName) {
    logger.error('removeTagFromTask called without tagName');
    return {
      success: false,
      error: {
        message: 'tagName is required'
      }
    };
  }
  
  if (!taskId && !customTaskId && !taskName) {
    logger.error('removeTagFromTask called without task identifier');
    return {
      success: false,
      error: {
        message: 'Either taskId, customTaskId, or taskName is required'
      }
    };
  }

  logger.info('Removing tag from task', { taskId, customTaskId, taskName, listName, tagName });
  
  try {
    // Resolve the task ID
    const taskIdResult = await resolveTaskId({ taskId, customTaskId, taskName, listName });
    
    if (!taskIdResult.success) {
      return {
        success: false,
        error: taskIdResult.error
      };
    }
    
    // Remove tag from the task
    const result = await clickUpServices.tag.removeTagFromTask(taskIdResult.taskId, tagName);
    
    if (!result.success) {
      logger.error('Failed to remove tag from task', result.error);
      return {
        success: false,
        error: result.error || {
          message: 'Failed to remove tag from task'
        }
      };
    }
    
    logger.info(`Successfully removed tag "${tagName}" from task ${taskIdResult.taskId}`);
    
    return {
      success: true
    };
  } catch (error) {
    logger.error('Error in removeTagFromTask', error);
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