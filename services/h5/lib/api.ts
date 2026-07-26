import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

export interface ReportData {
  id: string;
  h5Url: string;
  pdfUrl: string | null;
  qrCodeUrl: string;
  shareToken: string;
  assessment: {
    id: string;
    type: string;
    createdAt: string;
    photoFrontKey: string | null;
    photoSideKey: string | null;
    annotatedImageKey: string | null;
    // 服务端生成的签名 URL（公开接口可直接访问）
    annotatedImageUrl?: string | null;
    photoFrontUrl?: string | null;
    photoSideUrl?: string | null;
    qualityScore: number | null;
    member: {
      id: string;
      name: string;
      gender: string | null;
      ageRange: string | null;
    };
    coach: {
      id: string;
      name: string | null;
    };
    metrics: {
      shoulderRoundness: number;
      headForward: number;
      pelvicTilt: number;
      shoulderDiff: number;
      kneeHyperextension: number;
      overallScore: number;
    } | null;
    studio: {
      id: string;
      name: string;
      logoUrl: string | null;
    };
  };
}

export async function fetchReport(shareToken: string): Promise<ReportData> {
  const response = await api.get(`/share/reports/${shareToken}`);
  return response.data;
}
