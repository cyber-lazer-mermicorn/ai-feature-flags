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

export async function getAIModel(flagName: string, userId: string) {
  try {
    const { data: flag, error: flagError } = await supabase
      .from('ai_feature_flags')
      .select('*')
      .eq('name', flagName)
      .single();

    if (flagError) throw flagError;
    if (!flag || !flag.enabled) {
      return { model: 'gpt-4-turbo-preview', fallback: true };
    }

    const userHash = hashUserId(userId);
    if (userHash > flag.rollout_percentage) {
      return { model: 'gpt-4-turbo-preview', fallback: true };
    }

    const { data: usage, error: usageError } = await supabase
      .from('ai_usage')
      .select('cost')
      .eq('user_id', userId)
      .eq('flag_name', flagName)
      .gte('created_at', getMonthStart());

    if (usageError) throw usageError;

    const totalCost = usage?.reduce((sum, u) => sum + u.cost, 0) || 0;
    if (totalCost >= flag.cost_limit) {
      return { model: 'gpt-4-turbo-preview', fallback: true, reason: 'cost_limit' };
    }

    return { model: flag.model, fallback: false };
  } catch (error: any) {
    throw new Error(`Feature flag error: ${error?.message || 'Unknown error'}`);
  }
}

export async function trackUsage(flagName: string, userId: string, tokens: number, cost: number) {
  try {
    const { error } = await supabase.from('ai_usage').insert({
      flag_name: flagName,
      user_id: userId,
      tokens,
      cost,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;
  } catch (error: any) {
    throw new Error(`Usage tracking error: ${error?.message || 'Unknown error'}`);
  }
}

export async function monitorQuality(flagName: string, metric: number) {
  try {
    const { data: flag, error: flagError } = await supabase
      .from('ai_feature_flags')
      .select('quality_threshold')
      .eq('name', flagName)
      .single();

    if (flagError) throw flagError;

    if (flag && metric < flag.quality_threshold) {
      const { error: updateError } = await supabase
        .from('ai_feature_flags')
        .update({ enabled: false })
        .eq('name', flagName);

      if (updateError) throw updateError;

      const { error: alertError } = await supabase.from('ai_alerts').insert({
        flag_name: flagName,
        type: 'quality_degradation',
        metric,
        threshold: flag.quality_threshold,
      });

      if (alertError) throw alertError;

      return { rolledBack: true, reason: 'quality_degradation' };
    }

    return { rolledBack: false };
  } catch (error: any) {
    throw new Error(`Quality monitoring error: ${error?.message || 'Unknown error'}`);
  }
}

export async function rollbackFlag(flagName: string, reason: string) {
  try {
    const { error: updateError } = await supabase
      .from('ai_feature_flags')
      .update({ enabled: false })
      .eq('name', flagName);

    if (updateError) throw updateError;

    const { error: logError } = await supabase.from('ai_rollback_log').insert({
      flag_name: flagName,
      reason,
      rolled_back_at: new Date().toISOString(),
    });

    if (logError) throw logError;
  } catch (error: any) {
    throw new Error(`Rollback error: ${error?.message || 'Unknown error'}`);
  }
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