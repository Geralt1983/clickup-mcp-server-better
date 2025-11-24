/**
 * SPDX-FileCopyrightText: © 2025 Talib Kareem <taazkareem@icloud.com>
 * SPDX-License-Identifier: MIT
 *
 * Generic API passthrough tool that allows calling any ClickUp endpoint.
 */

import { customRequestService } from '../services/shared.js';
import { sponsorService } from '../utils/sponsor-service.js';

export const callClickUpApiTool = {
  name: "call_clickup_api",
  description: "Call any ClickUp API endpoint with a raw HTTP request. Useful for dashboards, docs, spaces, tags, custom fields, and other endpoints not covered by dedicated tools.",
  inputSchema: {
    type: "object",
    properties: {
      method: {
        type: "string",
        description: "HTTP method (GET, POST, PUT, PATCH, DELETE)",
      },
      path: {
        type: "string",
        description: "API path relative to /api/v2 (e.g., /team/{teamId}/task, /space, /dashboard)",
      },
      query: {
        type: "object",
        description: "Optional query string parameters object",
      },
      body: {
        type: "object",
        description: "Optional request body for POST/PUT/PATCH calls",
      },
      headers: {
        type: "object",
        description: "Optional additional headers to send with the request",
      },
    },
    required: ["method", "path"],
  },
};

export async function handleCallClickUpApi(params: any) {
  sponsorService.addSponsorMessageIfNeeded();

  const { method, path, query, body, headers } = params || {};
  const response = await customRequestService.callApi({ method, path, query, body, headers });

  return {
    status: response.status,
    path: response.path,
    method: response.method,
    headers: response.headers,
    data: response.data,
  };
}
