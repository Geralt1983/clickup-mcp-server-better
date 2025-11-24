/**
 * SPDX-FileCopyrightText: © 2025 Talib Kareem <taazkareem@icloud.com>
 * SPDX-License-Identifier: MIT
 *
 * ClickUp MCP Folder Tools
 * 
 * This module defines folder-related tools for creating, retrieving,
 * updating, and deleting folders in the ClickUp workspace hierarchy.
 */

import { 
  CreateFolderData, 
  ClickUpFolder
} from '../services/clickup/types.js';
import { clickUpServices } from '../services/shared.js';
import config from '../config.js';
import { sponsorService } from '../utils/sponsor-service.js';

// Use shared services instance
const { folder: folderService, workspace: workspaceService } = clickUpServices;

/**
 * Tool definition for creating a folder
 */
export const createFolderTool = {
  name: "create_folder",
  description: `Creates folder in ClickUp space. Use spaceId (preferred) or spaceName + folder name. Optional: override_statuses for folder-specific statuses. Use create_list_in_folder to add lists after creation.`,
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Name of the folder"
      },
      spaceId: {
        type: "string",
        description: "ID of the space to create the folder in (preferred). Use this instead of spaceName if you have it."
      },
      spaceName: {
        type: "string",
        description: "Name of the space to create the folder in. Only use if you don't have spaceId."
      },
      override_statuses: {
        type: "boolean",
        description: "Whether to override space statuses with folder-specific statuses"
      }
    },
    required: ["name"]
  }
};

/**
 * Tool definition for retrieving folder details
 */
export const getFolderTool = {
  name: "get_folder",
  description: `Gets folder details. Use folderId (preferred) or folderName + (spaceId/spaceName). Helps understand folder structure before creating/updating lists.`,
  inputSchema: {
    type: "object",
    properties: {
      folderId: {
        type: "string",
        description: "ID of folder to retrieve (preferred). Use this instead of folderName if you have it."
      },
      folderName: {
        type: "string",
        description: "Name of folder to retrieve. When using this, you MUST also provide spaceId or spaceName."
      },
      spaceId: {
        type: "string",
        description: "ID of space containing the folder (required with folderName). Use this instead of spaceName if you have it."
      },
      spaceName: {
        type: "string",
        description: "Name of space containing the folder (required with folderName). Only use if you don't have spaceId."
      }
    },
    required: []
  }
};

/**
 * Tool definition for updating a folder
 */
export const updateFolderTool = {
  name: "update_folder",
  description: `Updates folder properties. Use folderId (preferred) or folderName + (spaceId/spaceName). At least one update field (name/override_statuses) required. Changes apply to all lists in folder.`,
  inputSchema: {
    type: "object",
    properties: {
      folderId: {
        type: "string",
        description: "ID of folder to update (preferred). Use this instead of folderName if you have it."
      },
      folderName: {
        type: "string",
        description: "Name of folder to update. When using this, you MUST also provide spaceId or spaceName."
      },
      spaceId: {
        type: "string",
        description: "ID of space containing the folder (required with folderName). Use this instead of spaceName if you have it."
      },
      spaceName: {
        type: "string",
        description: "Name of space containing the folder (required with folderName). Only use if you don't have spaceId."
      },
      name: {
        type: "string",
        description: "New name for the folder"
      },
      override_statuses: {
        type: "boolean",
        description: "Whether to override space statuses with folder-specific statuses"
      }
    },
    required: []
  }
};

/**
 * Tool definition for deleting a folder
 */
export const deleteFolderTool = {
  name: "delete_folder",
  description: `PERMANENTLY deletes folder and all contents. Use folderId (preferred/safest) or folderName + (spaceId/spaceName). WARNING: Cannot be undone, all lists/tasks deleted, folderName risky if not unique.`,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
  },
  inputSchema: {
    type: "object",
    properties: {
      folderId: {
        type: "string",
        description: "ID of folder to delete (preferred). Use this instead of folderName for safety."
      },
      folderName: {
        type: "string",
        description: "Name of folder to delete. When using this, you MUST also provide spaceId or spaceName."
      },
      spaceId: {
        type: "string",
        description: "ID of space containing the folder (required with folderName). Use this instead of spaceName if you have it."
      },
      spaceName: {
        type: "string",
        description: "Name of space containing the folder (required with folderName). Only use if you don't have spaceId."
      }
    },
    required: []
  }
};

/**
 * Handler for the create_folder tool
 * Creates a new folder in a space
 */
export async function handleCreateFolder(parameters: any) {
  const { name, spaceId, spaceName, override_statuses } = parameters;
  
  // Validate required fields
  if (!name) {
    throw new Error("Folder name is required");
  }
  
  let targetSpaceId = spaceId;
  
  // If no spaceId but spaceName is provided, look up the space ID
  if (!targetSpaceId && spaceName) {
    const spaceIdResult = await workspaceService.findSpaceByName(spaceName);
    if (!spaceIdResult) {
      throw new Error(`Space "${spaceName}" not found`);
    }
    targetSpaceId = spaceIdResult.id;
  }
  
  if (!targetSpaceId) {
    throw new Error("Either spaceId or spaceName must be provided");
  }

  // Prepare folder data
  const folderData: CreateFolderData = {
    name
  };

  // Add optional fields if provided
  if (override_statuses !== undefined) folderData.override_statuses = override_statuses;

  try {
    // Create the folder
    const newFolder = await folderService.createFolder(targetSpaceId, folderData);
    
    return sponsorService.createResponse({
      id: newFolder.id,
      name: newFolder.name,
      space: {
        id: newFolder.space.id,
        name: newFolder.space.name
      },
      message: `Folder "${newFolder.name}" created successfully`
    }, true);
  } catch (error: any) {
    return sponsorService.createErrorResponse(`Failed to create folder: ${error.message}`);
  }
}

/**
 * Handler for the get_folder tool
 * Retrieves details about a specific folder
 */
export async function handleGetFolder(parameters: any) {
  const { folderId, folderName, spaceId, spaceName } = parameters;
  
  let targetFolderId = folderId;
  
  // If no folderId provided but folderName is, look up the folder ID
  if (!targetFolderId && folderName) {
    let targetSpaceId = spaceId;
    
    // If no spaceId provided but spaceName is, look up the space ID first
    if (!targetSpaceId && spaceName) {
      const spaceIdResult = await workspaceService.findSpaceByName(spaceName);
      if (!spaceIdResult) {
        throw new Error(`Space "${spaceName}" not found`);
      }
      targetSpaceId = spaceIdResult.id;
    }
    
    if (!targetSpaceId) {
      throw new Error("Either spaceId or spaceName must be provided when using folderName");
    }
    
    const folderResult = await folderService.findFolderByName(targetSpaceId, folderName);
    if (!folderResult) {
      throw new Error(`Folder "${folderName}" not found in space`);
    }
    targetFolderId = folderResult.id;
  }
  
  if (!targetFolderId) {
    throw new Error("Either folderId or folderName must be provided");
  }

  try {
    // Get the folder
    const folder = await folderService.getFolder(targetFolderId);
    
    return sponsorService.createResponse({
      id: folder.id,
      name: folder.name,
      space: {
        id: folder.space.id,
        name: folder.space.name
      }
    }, true);
  } catch (error: any) {
    return sponsorService.createErrorResponse(`Failed to retrieve folder: ${error.message}`);
  }
}

/**
 * Handler for the update_folder tool
 * Updates an existing folder's properties
 */
export async function handleUpdateFolder(parameters: any) {
  const { folderId, folderName, name, override_statuses, spaceId, spaceName } = parameters;
  
  let targetFolderId = folderId;
  
  // If no folderId provided but folderName is, look up the folder ID
  if (!targetFolderId && folderName) {
    let targetSpaceId = spaceId;
    
    // If no spaceId provided but spaceName is, look up the space ID first
    if (!targetSpaceId && spaceName) {
      const spaceIdResult = await workspaceService.findSpaceByName(spaceName);
      if (!spaceIdResult) {
        throw new Error(`Space "${spaceName}" not found`);
      }
      targetSpaceId = spaceIdResult.id;
    }
    
    if (!targetSpaceId) {
      throw new Error("Either spaceId or spaceName must be provided when using folderName");
    }
    
    const folderResult = await folderService.findFolderByName(targetSpaceId, folderName);
    if (!folderResult) {
      throw new Error(`Folder "${folderName}" not found in space`);
    }
    targetFolderId = folderResult.id;
  }
  
  if (!targetFolderId) {
    throw new Error("Either folderId or folderName must be provided");
  }
  
  // Ensure at least one update field is provided
  if (!name && override_statuses === undefined) {
    throw new Error("At least one of name or override_statuses must be provided for update");
  }

  // Prepare update data
  const updateData: Partial<CreateFolderData> = {};
  if (name) updateData.name = name;
  if (override_statuses !== undefined) updateData.override_statuses = override_statuses;

  try {
    // Update the folder
    const updatedFolder = await folderService.updateFolder(targetFolderId, updateData);
    
    return sponsorService.createResponse({
      id: updatedFolder.id,
      name: updatedFolder.name,
      space: {
        id: updatedFolder.space.id,
        name: updatedFolder.space.name
      },
      message: `Folder "${updatedFolder.name}" updated successfully`
    }, true);
  } catch (error: any) {
    return sponsorService.createErrorResponse(`Failed to update folder: ${error.message}`);
  }
}

/**
 * Handler for the delete_folder tool
 * Permanently removes a folder from the workspace
 */
export async function handleDeleteFolder(parameters: any) {
  const { folderId, folderName, spaceId, spaceName } = parameters;
  
  let targetFolderId = folderId;
  
  // If no folderId provided but folderName is, look up the folder ID
  if (!targetFolderId && folderName) {
    let targetSpaceId = spaceId;
    
    // If no spaceId provided but spaceName is, look up the space ID first
    if (!targetSpaceId && spaceName) {
      const spaceIdResult = await workspaceService.findSpaceByName(spaceName);
      if (!spaceIdResult) {
        throw new Error(`Space "${spaceName}" not found`);
      }
      targetSpaceId = spaceIdResult.id;
    }
    
    if (!targetSpaceId) {
      throw new Error("Either spaceId or spaceName must be provided when using folderName");
    }
    
    const folderResult = await folderService.findFolderByName(targetSpaceId, folderName);
    if (!folderResult) {
      throw new Error(`Folder "${folderName}" not found in space`);
    }
    targetFolderId = folderResult.id;
  }
  
  if (!targetFolderId) {
    throw new Error("Either folderId or folderName must be provided");
  }

  try {
    // Get folder details before deletion for confirmation message
    const folder = await folderService.getFolder(targetFolderId);
    const folderName = folder.name;
    
    // Delete the folder
    await folderService.deleteFolder(targetFolderId);
    
    return sponsorService.createResponse({
      success: true,
      message: `Folder "${folderName || targetFolderId}" deleted successfully`
    }, true);
  } catch (error: any) {
    return sponsorService.createErrorResponse(`Failed to delete folder: ${error.message}`);
  }
} 