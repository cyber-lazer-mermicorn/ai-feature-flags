import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetSegments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ABTest {
  id: string;
  name: string;
  variants: { name: string; weight: number }[];
  winner?: string;
  startDate: string;
  endDate?: string;
}

// Get feature flag
export async function getFeatureFlag(name: string, userId?: string) {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('name', name)
      .single();

    if (error) throw error;

    if (!data.enabled) {
      return { enabled: false, value: false };
    }

    // Check rollout percentage
    if (userId) {
      const hash = simpleHash(userId + name);
      const userPercentage = hash % 100;
      if (userPercentage >= data.rollout_percentage) {
        return { enabled: false, value: false };
      }
    }

    // Check target segments
    if (data.target_segments && data.target_segments.length > 0) {
      if (userId) {
        const { data: userData } = await supabase
          .from('users')
          .select('segment')
          .eq('id', userId)
          .single();

        if (userData && !data.target_segments.includes(userData.segment)) {
          return { enabled: false, value: false };
        }
      }
    }

    return { enabled: true, value: data.value || true };
  } catch (error: any) {
    throw new Error(`Get feature flag error: ${error?.message || 'Unknown error'}`);
  }
}

// Set feature flag
export async function setFeatureFlag(name: string, enabled: boolean, options?: {
  rolloutPercentage?: number;
  targetSegments?: string[];
  value?: any;
}) {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .upsert({
        name,
        enabled,
        rollout_percentage: options?.rolloutPercentage ?? 100,
        target_segments: options?.targetSegments ?? [],
        value: options?.value,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    throw new Error(`Set feature flag error: ${error?.message || 'Unknown error'}`);
  }
}

// Get AI model selection based on flags
export async function getAIModel(userId?: string) {
  try {
    const flag = await getFeatureFlag('ai_model', userId);
    if (flag.enabled) {
      return flag.value || 'gpt-4-turbo-preview';
    }
    return 'gpt-3.5-turbo';
  } catch (error: any) {
    throw new Error(`Get AI model error: ${error?.message || 'Unknown error'}`);
  }
}

// Get cost limits
export async function getCostLimits(userId?: string) {
  try {
    const flag = await getFeatureFlag('cost_limits', userId);
    if (flag.enabled) {
      return flag.value || { daily: 100, monthly: 2000 };
    }
    return { daily: 10, monthly: 100 };
  } catch (error: any) {
    throw new Error(`Get cost limits error: ${error?.message || 'Unknown error'}`);
  }
}

// Get quality monitoring settings
export async function getQualityMonitoring(userId?: string) {
  try {
    const flag = await getFeatureFlag('quality_monitoring', userId);
    if (flag.enabled) {
      return flag.value || { enabled: true, threshold: 0.8 };
    }
    return { enabled: false, threshold: 0.5 };
  } catch (error: any) {
    throw new Error(`Get quality monitoring error: ${error?.message || 'Unknown error'}`);
  }
}

// Start A/B test
export async function startABTest(name: string, variants: { name: string; weight: number }[]) {
  try {
    const { data, error } = await supabase
      .from('ab_tests')
      .insert({
        name,
        variants,
        start_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    throw new Error(`Start A/B test error: ${error?.message || 'Unknown error'}`);
  }
}

// Get A/B test variant
export async function getABTestVariant(testName: string, userId: string) {
  try {
    const { data: test, error: testError } = await supabase
      .from('ab_tests')
      .select('*')
      .eq('name', testName)
      .single();

    if (testError) throw testError;

    const hash = simpleHash(userId + testName);
    const totalWeight = test.variants.reduce((sum: number, v: any) => sum + v.weight, 0);
    let cumulative = 0;

    for (const variant of test.variants) {
      cumulative += variant.weight;
      if (hash % totalWeight < cumulative) {
        return variant.name;
      }
    }

    return test.variants[0].name;
  } catch (error: any) {
    throw new Error(`Get A/B test variant error: ${error?.message || 'Unknown error'}`);
  }
}

// Track A/B test conversion
export async function trackConversion(testName: string, userId: string, variant: string) {
  try {
    const { error } = await supabase
      .from('ab_test_conversions')
      .insert({
        test_name: testName,
        user_id: userId,
        variant,
        timestamp: new Date().toISOString(),
      });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    throw new Error(`Track conversion error: ${error?.message || 'Unknown error'}`);
  }
}

// Get A/B test results
export async function getABTestResults(testName: string) {
  try {
    const { data: conversions, error } = await supabase
      .from('ab_test_conversions')
      .select('*')
      .eq('test_name', testName);

    if (error) throw error;

    const results: Record<string, number> = {};
    for (const conv of conversions || []) {
      results[conv.variant] = (results[conv.variant] || 0) + 1;
    }

    return { testName, results, totalConversions: conversions?.length || 0 };
  } catch (error: any) {
    throw new Error(`Get A/B test results error: ${error?.message || 'Unknown error'}`);
  }
}

// Simple hash function
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// List all feature flags
export async function listFeatureFlags() {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error: any) {
    throw new Error(`List feature flags error: ${error?.message || 'Unknown error'}`);
  }
}

// Delete feature flag
export async function deleteFeatureFlag(name: string) {
  try {
    const { error } = await supabase
      .from('feature_flags')
      .delete()
      .eq('name', name);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    throw new Error(`Delete feature flag error: ${error?.message || 'Unknown error'}`);
  }
}
