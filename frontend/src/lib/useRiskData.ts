import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';
import { VerificationStatus, SlopeUnitRisk, SlopeUnitsResponse } from '../types';

export function useMergedRiskData(district: string = 'aizawl') {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['mergedRiskData', district, api.getDataSource()],
    queryFn: () => api.getMergedSlopeUnits(district),
    staleTime: 30 * 1000,
    retry: (failureCount, error) => {
      // Don't retry indefinitely on 404
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 2;
    },
  });

  const updateVerificationMutation = useMutation({
    mutationFn: ({
      id,
      status,
      notes,
      verifiedBy,
    }: {
      id: string;
      status: VerificationStatus;
      notes?: string;
      verifiedBy?: string;
    }) => api.updateVerificationStatus(id, status, verifiedBy, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mergedRiskData'] });
      queryClient.invalidateQueries({ queryKey: ['riskDashboard'] });
    },
  });

  const data = query.data;
  let slopeUnitsList: SlopeUnitRisk[] = [];
  if (data?.riskDashboard?.data && data.riskDashboard.data.length > 0) {
    slopeUnitsList = data.riskDashboard.data;
  } else if (data?.mergedFeatures && data.mergedFeatures.length > 0) {
    slopeUnitsList = data.mergedFeatures.map((f) => {
      const p = f.properties as any;
      return {
        slope_unit_id: p.slope_unit_id,
        ward_name: p.ward_name || p.slope_unit_id,
        risk_level: p.risk_level ?? null,
        failure_probability: p.failure_probability ?? p.probability ?? 0,
        susceptibility_score: p.susceptibility_score ?? 0,
        exposed_population: p.exposed_population ?? p.exposure_summary?.estimated_population ?? 0,
        critical_infrastructure_count: p.critical_infrastructure_count ?? p.exposure_summary?.critical_facility_count ?? 0,
        top_contributing_factors: p.top_contributing_factors || (p.why ? p.why.map((w: string, i: number) => ({ feature: w, contribution: 0.35 - i * 0.1 })) : []),
        verification_status: p.verification_status || 'PENDING_VERIFICATION',
        verified_by: p.verified_by || null,
        verified_at: p.verified_at || null,
        verification_notes: p.verification_notes || p.officer_notes || null,
      };
    });
  }

  const meta = data?.riskDashboard?.meta || null;
  const summary = data?.riskDashboard?.summary || null;
  const geoJsonData: SlopeUnitsResponse | null = (data?.slopeUnits && data.slopeUnits.features && data.slopeUnits.features.length > 0)
    ? data.slopeUnits
    : (data?.mergedFeatures ? { type: 'FeatureCollection', features: data.mergedFeatures } : null);
  const dashboardData = data?.riskDashboard || null;

  return {
    ...query,
    geoJsonData,
    dashboardData,
    slopeUnitsList,
    meta,
    summary,
    updateVerificationStatus: (
      slopeUnitId: string,
      status: VerificationStatus,
      notes?: string,
      verifiedBy?: string
    ) => updateVerificationMutation.mutate({ id: slopeUnitId, status, notes, verifiedBy }),
    isUpdating: updateVerificationMutation.isPending,
  };
}

export function useRiskDashboard(district: string = 'aizawl') {
  return useQuery({
    queryKey: ['riskDashboard', district, api.getDataSource()],
    queryFn: () => api.getRiskData(district),
    staleTime: 30 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 404) return false;
      return failureCount < 2;
    },
  });
}

export function useSlopeUnitsGeoJson(district: string = 'aizawl') {
  return useQuery({
    queryKey: ['slopeUnitsGeoJson', district, api.getDataSource()],
    queryFn: () => api.getSlopeUnitsGeoJson(district),
    staleTime: 60 * 1000,
  });
}

export function usePredictions() {
  return useQuery({
    queryKey: ['predictions'],
    queryFn: () => api.getPredictions(),
    staleTime: 60 * 1000,
  });
}

export function useTerrainData() {
  return useQuery({
    queryKey: ['terrainData'],
    queryFn: () => api.getTerrainData(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: VerificationStatus; notes?: string }) =>
      api.updateVerificationStatus(id, status, 'Officer L. Ralte (NDMA Field Geotechnical)', notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['riskDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['mergedRiskData'] });
    },
  });
}
