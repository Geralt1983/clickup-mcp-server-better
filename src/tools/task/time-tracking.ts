/**
 * SPDX-FileCopyrightText: © 2025 Talib Kareem <taazkareem@icloud.com>
 * SPDX-License-Identifier: MIT
 *
 * Task time tracking tools
 * 
 * This module provides tools for time tracking operations on ClickUp tasks:
 * - Get time entries for a task
 * - Start time tracking on a task
 * - Stop time tracking
 * - Add a manual time entry
 * - Delete a time entry
 */

import { timeTrackingService } from "../../services/shared.js";
import { getTaskId } from "./utilities.js";
import { Logger } from "../../logger.js";
import { ErrorCode } from "../../services/clickup/base.js";
import { formatDueDate, parseDueDate } from "../../utils/date-utils.js";

// Logger instance
const logger = new Logger('TimeTrackingTools');

/**
 * Tool definition for getting time entries
 */
export const getTaskTimeEntriesTool = {
  name: "get_task_time_entries",
  description: "Gets all time entries for a task with filtering options. Use taskId (preferred) or taskName + optional listName. Returns all tracked time with user info, descriptions, tags, start/end times, and durations.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "ID of the task to get time entries for. Works with both regular task IDs and custom IDs."
      },
      taskName: {
        type: "string",
        description: "Name of the task to get time entries for. When using this parameter, it's recommended to also provide listName."
      },
      listName: {
        type: "string",
        description: "Name of the list containing the task. Helps find the right task when using taskName."
      },
      startDate: {
        type: "string",
        description: "Optional start date filter. Supports Unix timestamps (in milliseconds) and natural language expressions like 'yesterday', 'last week', etc."
      },
      endDate: {
        type: "string",
        description: "Optional end date filter. Supports Unix timestamps (in milliseconds) and natural language expressions."
      }
    }
  }
};

/**
 * Tool definition for starting time tracking
 */
export const startTimeTrackingTool = {
  name: "start_time_tracking",
  description: "Starts time tracking on a task. Use taskId (preferred) or taskName + optional listName. Optional fields: description, billable status, and tags. Only one timer can be running at a time.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "ID of the task to start tracking time on. Works with both regular task IDs and custom IDs."
      },
      taskName: {
        type: "string",
        description: "Name of the task to start tracking time on. When using this parameter, it's recommended to also provide listName."
      },
      listName: {
        type: "string",
        description: "Name of the list containing the task. Helps find the right task when using taskName."
      },
      description: {
        type: "string",
        description: "Optional description for the time entry."
      },
      billable: {
        type: "boolean",
        description: "Whether this time is billable. Default is workspace setting."
      },
      tags: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Optional array of tag names to assign to the time entry."
      }
    }
  }
};

/**
 * Tool definition for stopping time tracking
 */
export const stopTimeTrackingTool = {
  name: "stop_time_tracking",
  description: "Stops the currently running time tracker. Optional fields: description and tags. Returns the completed time entry details.",
  inputSchema: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "Optional description to update or add to the time entry."
      },
      tags: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Optional array of tag names to assign to the time entry."
      }
    }
  }
};

/**
 * Tool definition for adding a manual time entry
 */
export const addTimeEntryTool = {
  name: "add_time_entry",
  description: "Adds a manual time entry to a task. Use taskId (preferred) or taskName + optional listName. Required: start time, duration. Optional: description, billable, tags.",
  inputSchema: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "ID of the task to add time entry to. Works with both regular task IDs and custom IDs."
      },
      taskName: {
        type: "string",
        description: "Name of the task to add time entry to. When using this parameter, it's recommended to also provide listName."
      },
      listName: {
        type: "string",
        description: "Name of the list containing the task. Helps find the right task when using taskName."
      },
      start: {
        type: "string",
        description: "Start time for the entry. Supports Unix timestamps (in milliseconds) and natural language expressions like '2 hours ago', 'yesterday 9am', etc."
      },
      duration: {
        type: "string",
        description: "Duration of the time entry. Format as 'Xh Ym' (e.g., '1h 30m') or just minutes (e.g., '90m')."
      },
      description: {
        type: "string",
        description: "Optional description for the time entry."
      },
      billable: {
        type: "boolean",
        description: "Whether this time is billable. Default is workspace setting."
      },
      tags: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Optional array of tag names to assign to the time entry."
      }
    },
    required: ["start", "duration"]
  }
};

/**
 * Tool definition for deleting a time entry
 */
export const deleteTimeEntryTool = {
  name: "delete_time_entry",
  description: "Deletes a time entry. Required: time entry ID.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
  },
  inputSchema: {
    type: "object",
    properties: {
      timeEntryId: {
        type: "string",
        description: "ID of the time entry to delete."
      }
    },
    required: ["timeEntryId"]
  }
};

/**
 * Tool definition for getting current time entry
 */
export const getCurrentTimeEntryTool = {
  name: "get_current_time_entry",
  description: "Gets the currently running time entry, if any. No parameters needed.",
  inputSchema: {
    type: "object",
    properties: {}
  }
};

/**
 * Handle get task time entries tool
 */
export async function handleGetTaskTimeEntries(params: any) {
  logger.info("Handling request to get task time entries", params);
  
  try {
    // Resolve task ID
    const taskId = await getTaskId(params.taskId, params.taskName, params.listName);
    if (!taskId) {
      return {
        success: false,
        error: {
          message: "Task not found. Please provide a valid taskId or taskName + listName combination."
        }
      };
    }
    
    // Parse date filters
    let startDate: number | undefined;
    let endDate: number | undefined;
    
    if (params.startDate) {
      startDate = parseDueDate(params.startDate);
    }
    
    if (params.endDate) {
      endDate = parseDueDate(params.endDate);
    }
    
    // Get time entries
    const result = await timeTrackingService.getTimeEntries(taskId, startDate, endDate);
    
    if (!result.success) {
      return {
        success: false,
        error: {
          message: result.error?.message || "Failed to get time entries"
        }
      };
    }
    
    const timeEntries = result.data || [];
    
    // Format the response
    return {
      success: true,
      time_entries: timeEntries.map(entry => ({
        id: entry.id,
        description: entry.description,
        start: entry.start,
        end: entry.end,
        duration: formatDuration(entry.duration),
        duration_ms: entry.duration,
        billable: entry.billable,
        tags: entry.tags,
        user: {
          id: entry.user.id,
          username: entry.user.username
        },
        task: {
          id: entry.task.id,
          name: entry.task.name,
          status: entry.task.status.status
        }
      }))
    };
  } catch (error) {
    logger.error("Error getting task time entries", error);
    return {
      success: false,
      error: {
        message: (error as Error).message || "An unknown error occurred"
      }
    };
  }
}

/**
 * Handle start time tracking tool
 */
export async function handleStartTimeTracking(params: any) {
  logger.info("Handling request to start time tracking", params);
  
  try {
    // Resolve task ID
    const taskId = await getTaskId(params.taskId, params.taskName, params.listName);
    if (!taskId) {
      return {
        success: false,
        error: {
          message: "Task not found. Please provide a valid taskId or taskName + listName combination."
        }
      };
    }
    
    // Check for currently running timer
    const currentTimerResult = await timeTrackingService.getCurrentTimeEntry();
    if (currentTimerResult.success && currentTimerResult.data) {
      return {
        success: false,
        error: {
          message: "A timer is already running. Please stop the current timer before starting a new one.",
          timer: {
            id: currentTimerResult.data.id,
            task: {
              id: currentTimerResult.data.task.id,
              name: currentTimerResult.data.task.name
            },
            start: currentTimerResult.data.start,
            description: currentTimerResult.data.description
          }
        }
      };
    }
    
    // Prepare request data
    const requestData = {
      tid: taskId,
      description: params.description,
      billable: params.billable,
      tags: params.tags
    };
    
    // Start time tracking
    const result = await timeTrackingService.startTimeTracking(requestData);
    
    if (!result.success) {
      return {
        success: false,
        error: {
          message: result.error?.message || "Failed to start time tracking"
        }
      };
    }
    
    const timeEntry = result.data;
    if (!timeEntry) {
      return {
        success: false,
        error: {
          message: "No time entry data returned from API"
        }
      };
    }
    
    // Format the response
    return {
      success: true,
      time_entry: {
        id: timeEntry.id,
        description: timeEntry.description,
        start: timeEntry.start,
        end: timeEntry.end,
        task: {
          id: timeEntry.task.id,
          name: timeEntry.task.name
        },
        billable: timeEntry.billable,
        tags: timeEntry.tags
      }
    };
  } catch (error) {
    logger.error("Error starting time tracking", error);
    return {
      success: false,
      error: {
        message: (error as Error).message || "An unknown error occurred"
      }
    };
  }
}

/**
 * Handle stop time tracking tool
 */
export async function handleStopTimeTracking(params: any) {
  logger.info("Handling request to stop time tracking", params);
  
  try {
    // Check for currently running timer
    const currentTimerResult = await timeTrackingService.getCurrentTimeEntry();
    if (currentTimerResult.success && !currentTimerResult.data) {
      return {
        success: false,
        error: {
          message: "No timer is currently running. Start a timer before trying to stop it."
        }
      };
    }
    
    // Prepare request data
    const requestData = {
      description: params.description,
      tags: params.tags
    };
    
    // Stop time tracking
    const result = await timeTrackingService.stopTimeTracking(requestData);
    
    if (!result.success) {
      return {
        success: false,
        error: {
          message: result.error?.message || "Failed to stop time tracking"
        }
      };
    }
    
    const timeEntry = result.data;
    if (!timeEntry) {
      return {
        success: false,
        error: {
          message: "No time entry data returned from API"
        }
      };
    }
    
    // Format the response
    return {
      success: true,
      time_entry: {
        id: timeEntry.id,
        description: timeEntry.description,
        start: timeEntry.start,
        end: timeEntry.end,
        duration: formatDuration(timeEntry.duration),
        duration_ms: timeEntry.duration,
        task: {
          id: timeEntry.task.id,
          name: timeEntry.task.name
        },
        billable: timeEntry.billable,
        tags: timeEntry.tags
      }
    };
  } catch (error) {
    logger.error("Error stopping time tracking", error);
    return {
      success: false,
      error: {
        message: (error as Error).message || "An unknown error occurred"
      }
    };
  }
}

/**
 * Handle add time entry tool
 */
export async function handleAddTimeEntry(params: any) {
  logger.info("Handling request to add time entry", params);
  
  try {
    // Resolve task ID
    const taskId = await getTaskId(params.taskId, params.taskName, params.listName);
    if (!taskId) {
      return {
        success: false,
        error: {
          message: "Task not found. Please provide a valid taskId or taskName + listName combination."
        }
      };
    }
    
    // Parse start time
    const startTime = parseDueDate(params.start);
    if (!startTime) {
      return {
        success: false,
        error: {
          message: "Invalid start time format. Use a Unix timestamp (in milliseconds) or a natural language date string."
        }
      };
    }
    
    // Parse duration
    const durationMs = parseDuration(params.duration);
    if (durationMs === 0) {
      return {
        success: false,
        error: {
          message: "Invalid duration format. Use 'Xh Ym' format (e.g., '1h 30m') or just minutes (e.g., '90m')."
        }
      };
    }
    
    // Prepare request data
    const requestData = {
      tid: taskId,
      start: startTime,
      duration: durationMs,
      description: params.description,
      billable: params.billable,
      tags: params.tags
    };
    
    // Add time entry
    const result = await timeTrackingService.addTimeEntry(requestData);
    
    if (!result.success) {
      return {
        success: false,
        error: {
          message: result.error?.message || "Failed to add time entry"
        }
      };
    }
    
    const timeEntry = result.data;
    if (!timeEntry) {
      return {
        success: false,
        error: {
          message: "No time entry data returned from API"
        }
      };
    }
    
    // Format the response
    return {
      success: true,
      time_entry: {
        id: timeEntry.id,
        description: timeEntry.description,
        start: timeEntry.start,
        end: timeEntry.end,
        duration: formatDuration(timeEntry.duration),
        duration_ms: timeEntry.duration,
        task: {
          id: timeEntry.task.id,
          name: timeEntry.task.name
        },
        billable: timeEntry.billable,
        tags: timeEntry.tags
      }
    };
  } catch (error) {
    logger.error("Error adding time entry", error);
    return {
      success: false,
      error: {
        message: (error as Error).message || "An unknown error occurred"
      }
    };
  }
}

/**
 * Handle delete time entry tool
 */
export async function handleDeleteTimeEntry(params: any) {
  logger.info("Handling request to delete time entry", params);
  
  try {
    const { timeEntryId } = params;
    
    if (!timeEntryId) {
      return {
        success: false,
        error: {
          message: "Time entry ID is required."
        }
      };
    }
    
    // Delete time entry
    const result = await timeTrackingService.deleteTimeEntry(timeEntryId);
    
    if (!result.success) {
      return {
        success: false,
        error: {
          message: result.error?.message || "Failed to delete time entry"
        }
      };
    }
    
    // Format the response
    return {
      success: true,
      message: "Time entry deleted successfully."
    };
  } catch (error) {
    logger.error("Error deleting time entry", error);
    return {
      success: false,
      error: {
        message: (error as Error).message || "An unknown error occurred"
      }
    };
  }
}

/**
 * Handle get current time entry tool
 */
export async function handleGetCurrentTimeEntry(params: any) {
  logger.info("Handling request to get current time entry");
  
  try {
    // Get current time entry
    const result = await timeTrackingService.getCurrentTimeEntry();
    
    if (!result.success) {
      return {
        success: false,
        error: {
          message: result.error?.message || "Failed to get current time entry"
        }
      };
    }
    
    const timeEntry = result.data;
    
    // If no timer is running
    if (!timeEntry) {
      return {
        success: true,
        timer_running: false,
        message: "No timer is currently running."
      };
    }
    
    // Format the response
    const elapsedTime = calculateElapsedTime(timeEntry.start);
    
    return {
      success: true,
      timer_running: true,
      time_entry: {
        id: timeEntry.id,
        description: timeEntry.description,
        start: timeEntry.start,
        elapsed: formatDuration(elapsedTime),
        elapsed_ms: elapsedTime,
        task: {
          id: timeEntry.task.id,
          name: timeEntry.task.name
        },
        billable: timeEntry.billable,
        tags: timeEntry.tags
      }
    };
  } catch (error) {
    logger.error("Error getting current time entry", error);
    return {
      success: false,
      error: {
        message: (error as Error).message || "An unknown error occurred"
      }
    };
  }
}

/**
 * Calculate elapsed time in milliseconds from a start time string to now
 */
function calculateElapsedTime(startTimeString: string): number {
  const startTime = new Date(startTimeString).getTime();
  const now = Date.now();
  return Math.max(0, now - startTime);
}

/**
 * Format duration in milliseconds to a human-readable string
 */
function formatDuration(durationMs: number): string {
  if (!durationMs) return "0m";
  
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours === 0) {
    return `${remainingMinutes}m`;
  } else if (remainingMinutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${remainingMinutes}m`;
  }
}

/**
 * Parse duration string to milliseconds
 */
function parseDuration(durationString: string): number {
  if (!durationString) return 0;
  
  // Clean the input and handle potential space issues
  const cleanDuration = durationString.trim().toLowerCase().replace(/\s+/g, ' ');
  
  // Handle simple minute format like "90m"
  if (/^\d+m$/.test(cleanDuration)) {
    const minutes = parseInt(cleanDuration.replace('m', ''), 10);
    return minutes * 60 * 1000;
  }
  
  // Handle simple hour format like "2h"
  if (/^\d+h$/.test(cleanDuration)) {
    const hours = parseInt(cleanDuration.replace('h', ''), 10);
    return hours * 60 * 60 * 1000;
  }
  
  // Handle combined format like "1h 30m"
  const combinedPattern = /^(\d+)h\s*(?:(\d+)m)?$|^(?:(\d+)h\s*)?(\d+)m$/;
  const match = cleanDuration.match(combinedPattern);
  
  if (match) {
    const hours = parseInt(match[1] || match[3] || '0', 10);
    const minutes = parseInt(match[2] || match[4] || '0', 10);
    return (hours * 60 * 60 + minutes * 60) * 1000;
  }
  
  // Try to parse as just a number of minutes
  const justMinutes = parseInt(cleanDuration, 10);
  if (!isNaN(justMinutes)) {
    return justMinutes * 60 * 1000;
  }
  
  return 0;
}

// Export all time tracking tools
export const timeTrackingTools = [
  getTaskTimeEntriesTool,
  startTimeTrackingTool,
  stopTimeTrackingTool,
  addTimeEntryTool,
  deleteTimeEntryTool,
  getCurrentTimeEntryTool
];

// Export all time tracking handlers
export const timeTrackingHandlers = {
  get_task_time_entries: handleGetTaskTimeEntries,
  start_time_tracking: handleStartTimeTracking,
  stop_time_tracking: handleStopTimeTracking,
  add_time_entry: handleAddTimeEntry,
  delete_time_entry: handleDeleteTimeEntry,
  get_current_time_entry: handleGetCurrentTimeEntry
};
