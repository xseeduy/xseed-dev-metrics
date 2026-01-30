// ============================================
// Notion Integration Types
// ============================================

export interface NotionUploadResult {
  success: boolean;
  uploaded: number;
  failed: number;
  errors?: string[];
}

export interface NotionPageHierarchy {
  gitMetricsPageId: string;
  clientPageId: string;
  userPageId: string;
}
