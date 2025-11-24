/**
 * SPDX-FileCopyrightText: © 2025 Talib Kareem <taazkareem@icloud.com>
 * SPDX-License-Identifier: MIT
 *
 * Generic ClickUp API passthrough service
 *
 * Provides a flexible way to call any ClickUp API endpoint while still using
 * the shared authentication, rate limiting, and error handling found in the
 * BaseClickUpService. This is intended for power users who want to access
 * endpoints that do not yet have a dedicated tool (dashboards, custom fields,
 * spaces, tags, etc.).
 */

import { BaseClickUpService, ClickUpServiceError, ErrorCode } from './base.js';

export type SupportedHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RawApiRequestOptions {
  method: string;
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface RawApiResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, unknown>;
  path: string;
  method: SupportedHttpMethod;
}

/**
 * Service that exposes a single method for calling arbitrary ClickUp API endpoints.
 */
export class CustomRequestService extends BaseClickUpService {
  /**
   * Execute a raw request against the ClickUp API using the shared HTTP client.
   */
  async callApi<T = unknown>(options: RawApiRequestOptions): Promise<RawApiResponse<T>> {
    const { method, path, query, body, headers } = options;
    const normalizedMethod = method?.toUpperCase() as SupportedHttpMethod | undefined;

    if (!normalizedMethod) {
      throw new ClickUpServiceError('HTTP method is required', ErrorCode.INVALID_PARAMETER);
    }

    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) {
      throw new ClickUpServiceError(
        `Unsupported HTTP method: ${method}. Use GET, POST, PUT, PATCH, or DELETE.`,
        ErrorCode.INVALID_PARAMETER
      );
    }

    if (!path || typeof path !== 'string') {
      throw new ClickUpServiceError('API path is required', ErrorCode.INVALID_PARAMETER);
    }

    if (/^https?:\/\//i.test(path)) {
      throw new ClickUpServiceError(
        'Provide ClickUp API paths relative to the API root (e.g., /team/{teamId}/goal)',
        ErrorCode.INVALID_PARAMETER
      );
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    this.traceRequest(normalizedMethod, normalizedPath, body);

    const response = await this.makeRequest(async () => {
      return this.client.request({
        method: normalizedMethod,
        url: normalizedPath,
        params: query,
        data: body,
        headers
      });
    });

    return {
      status: response.status,
      data: response.data as T,
      headers: response.headers,
      path: normalizedPath,
      method: normalizedMethod
    };
  }
}
