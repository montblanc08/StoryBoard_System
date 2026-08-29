/**
 * FrameForge API & Service Contract Specifications
 */

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'SHOT_REVISION_CONFLICT'
  | 'RATE_LIMITED'
  | 'STORAGE_ERROR'
  | 'INTERNAL_ERROR';

export function createErrorResponse(code: ApiErrorCode, message: string, details = {}): ApiErrorResponse {
  return {
    error: {
      code,
      message,
      details
    }
  };
}

/**
 * AI / Automation Provider Contract Interface (Spec Section 151)
 * Reserved interface without active AI dependencies.
 */
export type ProviderCapability =
  | 'screenplay_breakdown'
  | 'voice_alignment'
  | 'speech_to_text'
  | 'image_search'
  | 'storyboard_generation'
  | 'image_edit'
  | 'video_previsualization'
  | 'copyright_scan';

export interface ProviderJobRequest {
  jobId: string;
  capability: ProviderCapability;
  provider: string;
  model: string;
  inputAssetIds: string[];
  parameters: Record<string, unknown>;
}

export interface ProviderJobResponse {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  outputAssetIds?: string[];
  costEstimate?: number;
  error?: string;
}
