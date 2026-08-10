import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AIFeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  model: string;
  costLimit: number;
  qualityThreshold: number;
  rolloutPercentage: number;
}

// Get AI model for user with feature flag
export async function getAIModel(flagName: string, userId: string) {
  const { data: flag } = await supabase
    .from('ai_feature_flags')
    .select('*')
    .eq('name', flagName)
    .single();

  if (!flag || !flag.enabled) {
    return { model: 'gpt-4-turbo-preview', fallback: true };
  }

  // Check rollout percentage
  const userHash = hashUserId(userId);
  if (userHash > flag.rollout_percentage) {
    return { model: 'gpt-4-turbo-preview', fallback: true };
  }

  // Check cost limits
  const { data: usage } = await supabase
    .from('ai_usage')
    .select('cost')
    .eq('user_id', userId)
    .eq('flag_name', flagName)
    .gte('created_at', getMonthStart());

  const totalCost = usage?.reduce((sum, u) => sum + u.cost, 0) || 0;
  if (totalCost >= flag.cost_limit) {
    return { model: 'gpt-4-turbo-preview', fallback: true, reason: 'cost_limit' };
  }

  return { model: flag.model, fallback: false };
}

// Track AI usage
export async function trackUsage(flagName: string, userId: string, tokens: number, cost: number) {
  await supabase.from('ai_usage').insert({
    flag_name: flagName,
    user_id: userId,
    tokens,
    cost,
    created_at: new Date().toISOString(),
  });
}

// Monitor quality
export async function monitorQuality(flagName: string, metric: number) {
  const { data: flag } = await supabase
    .from('ai_feature_flags')
    .select('quality_threshold')
    .eq('name', flagName)
    .single();

  if (flag && metric < flag.quality_threshold) {
    // Auto-disable flag on quality degradation
    await supabase
      .from('ai_feature_flags')
      .update({ enabled: false })
      .eq('name', flagName);

    await supabase.from('ai_alerts').insert({
      flag_name: flagName,
      type: 'quality_degradation',
      metric,
      threshold: flag.quality_threshold,
    });

    return { rolledBack: true, reason: 'quality_degradation' };
  }

  return { rolledBack: false };
}

// Rollback flag
export async function rollbackFlag(flagName: string, reason: string) {
  await supabase
    .from('ai_feature_flags')
    .update({ enabled: false })
    .eq('name', flagName);

  await supabase.from('ai_rollback_log').insert({
    flag_name: flagName,
    reason,
    rolled_back_at: new Date().toISOString(),
  });
}

function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 100;
}

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}