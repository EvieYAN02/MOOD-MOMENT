export type MoodMode = 'Down' | 'Joy' | 'Drift';

export interface ReflectionResult {
  line: string;
  source: string;
}

interface QuoteItem {
  line: string;
  source: string;
}

const DOWN_QUOTES: Record<string, QuoteItem[]> = {
  tired: [
    { line: '你已经走了很远，慢一点不是退步，是在把自己接住。', source: '——《被讨厌的勇气》' },
    { line: '累的时候先停下，休息是为了把明天还给自己。', source: '——《山月记》' },
  ],
  sad: [
    { line: '难过不是你不够坚强，而是你一直很认真地在生活。', source: '——《月亮与六便士》' },
    { line: '允许情绪经过你，它会像雨一样，来过也会停。', source: '——《少有人走的路》' },
  ],
  anxiety: [
    { line: '先把今天缩小成一个小时，再把一个小时缩小成一件小事。', source: '——《当下的力量》' },
    { line: '你不必一次解决全部问题，先照顾呼吸，再照顾下一步。', source: '——《活出生命的意义》' },
  ],
  default: [
    { line: '你现在的状态值得被温柔对待，慢一点也完全可以。', source: '——《人间值得》' },
    { line: '先把自己放回身体里，答案会在安静里慢慢出现。', source: '——《悉达多》' },
  ],
};

const JOY_QUOTES: Record<string, QuoteItem[]> = {
  gratitude: [
    { line: '今天的光亮请好好收下，它会在未来某天再次照亮你。', source: '——《小王子》' },
    { line: '感谢被你看见的细小幸福，它们会成为长久的底气。', source: '——《瓦尔登湖》' },
  ],
  celebration: [
    { line: '你值得庆祝这一刻，把喜悦认真地记下来。', source: '——《爱丽丝梦游仙境》' },
    { line: '快乐不是浪费时间，快乐是在给生活续航。', source: '——《牧羊少年奇幻之旅》' },
  ],
  relation: [
    { line: '把这份温暖分享出去，它会在你与他人之间继续发光。', source: '——《夏目友人帐》' },
    { line: '被善意围住的时刻，请记得你也一直在照亮别人。', source: '——《奇迹男孩》' },
  ],
  default: [
    { line: '这份好心情值得被珍藏，未来的你会感谢今天的记录。', source: '——《追风筝的人》' },
    { line: '把快乐写下来，它会从瞬间变成可以反复依靠的记忆。', source: '——《小森林》' },
  ],
};

const DRIFT_QUOTES: Record<string, QuoteItem[]> = {
  confused: [
    { line: '迷路不等于走错，你只是在一段还没命名的路上。', source: '——《海边的卡夫卡》' },
    { line: '方向感会在移动中恢复，哪怕今天只迈出半步。', source: '——《禅与摩托车维修艺术》' },
  ],
  numb: [
    { line: '说不清也没关系，先把感受留在这里，就已经很好。', source: '——《夜航西飞》' },
    { line: '空白不是失败，它是心在为新的秩序腾位置。', source: '——《沉思录》' },
  ],
  lonely: [
    { line: '你不是一个人在漂流，至少此刻，这段文字在陪你。', source: '——《百年孤独》' },
    { line: '有些夜晚只适合被陪伴，不必急着被解释。', source: '——《挪威的森林》' },
  ],
  default: [
    { line: '先允许自己停在不确定里，答案通常在下一次呼吸之后。', source: '——《悉达多》' },
    { line: '不用急着定义现在，你正在靠近更真实的自己。', source: '——《一个人的朝圣》' },
  ],
};

function pickByHash(items: QuoteItem[], seed: string): QuoteItem {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return items[hash % items.length];
}

function detectBucket(text: string, mode: MoodMode): string {
  const t = text.toLowerCase();

  if (mode === 'Down') {
    if (/累|疲惫|撑不住|没力气|burnout|tired|exhausted/.test(t)) return 'tired';
    if (/难过|伤心|想哭|失落|sad|cry|upset/.test(t)) return 'sad';
    if (/焦虑|担心|害怕|慌|anx|anxiety|worry|panic/.test(t)) return 'anxiety';
    return 'default';
  }

  if (mode === 'Joy') {
    if (/感谢|感恩|幸运|grateful|gratitude|blessed/.test(t)) return 'gratitude';
    if (/开心|快乐|庆祝|太好了|yay|happy|celebrate/.test(t)) return 'celebration';
    if (/朋友|家人|我们|一起|love|share|team/.test(t)) return 'relation';
    return 'default';
  }

  if (/迷茫|不知道|方向|找不到|confused|lost|direction/.test(t)) return 'confused';
  if (/空|麻木|无感|blank|numb|empty/.test(t)) return 'numb';
  if (/孤独|一个人|没人懂|alone|lonely/.test(t)) return 'lonely';
  return 'default';
}

export function generateReflection(input: string, mode: MoodMode): ReflectionResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      line: '先写下一点点此刻的感受吧，哪怕只有一句话，我都会陪你读完。',
      source: '—— Mood Moment',
    };
  }

  const bucket = detectBucket(trimmed, mode);
  const seed = `${mode}:${bucket}:${trimmed}:${Date.now()}`;

  if (mode === 'Down') return pickByHash(DOWN_QUOTES[bucket] ?? DOWN_QUOTES.default, seed);
  if (mode === 'Joy') return pickByHash(JOY_QUOTES[bucket] ?? JOY_QUOTES.default, seed);
  return pickByHash(DRIFT_QUOTES[bucket] ?? DRIFT_QUOTES.default, seed);
}
