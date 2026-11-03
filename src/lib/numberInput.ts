/**
 * 数值输入的解析与夹紧（纯函数，便于单测）。
 *
 * UI 里的 Slider / NumberBadge 共用这套规则，保证「滑块能拖到的值」与
 * 「手输能得到的值」完全一致 —— 否则两套边界迟早会对不上。
 */

export type ParseFailure = 'empty' | 'nan';

export type ParseResult = { ok: true; value: number } | { ok: false; reason: ParseFailure };

/**
 * 把用户输入的文本解析成合法数值。
 * 规则的顺序：解析 → 按 step 吸附 → 夹紧到 [min, max] → 消除浮点噪声。
 */
export function parseNumericInput(
  text: string,
  min: number,
  max: number,
  step: number,
): ParseResult {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, reason: 'empty' };
  const raw = Number(trimmed);
  if (!Number.isFinite(raw)) return { ok: false, reason: 'nan' };
  return { ok: true, value: clampToStep(raw, min, max, step) };
}

/** step 吸附 + 区间夹紧 + 去掉浮点尾巴（0.1*3 -> 0.30000000000000004） */
export function clampToStep(value: number, min: number, max: number, step: number): number {
  // NaN 没有大小信息，落到下限；±Infinity 按方向落到对应边界
  if (Number.isNaN(value)) return min;
  if (value === Number.POSITIVE_INFINITY) return max;
  if (value === Number.NEGATIVE_INFINITY) return min;
  const snapped = step > 0 ? Math.round(value / step) * step : value;
  const clamped = Math.max(min, Math.min(max, snapped));
  return Number(clamped.toFixed(6));
}

/** 输入过程中用于「即时标红」的判定：不改变数值，只判断是否越界 */
export function isOutOfRange(text: string, min: number, max: number): boolean {
  const trimmed = text.trim();
  if (trimmed === '') return true;
  const raw = Number(trimmed);
  if (!Number.isFinite(raw)) return true;
  return raw < min || raw > max;
}
