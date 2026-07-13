/**
 * SMMS — 보컬 녹음 AI 분석 서버리스 함수 (Vercel Node.js Function)
 *
 * 이 파일은 브라우저가 아니라 서버(Vercel의 서버리스 런타임)에서 실행됩니다.
 * OpenAI API 키는 반드시 Vercel 프로젝트의 환경 변수(OPENAI_API_KEY)로만 설정하고,
 * 이 파일이나 프론트엔드(HTML/JS) 어디에도 하드코딩하지 않습니다.
 *
 * 요청 형식 (프론트엔드 → 이 함수):
 *   POST /api/analyze-vocal
 *   Content-Type: application/json
 *   { "audioBase64": "<base64 문자열, data: 접두어 제외>", "mimeType": "audio/mpeg", "songTitle": "인사 (범진)" }
 *
 * 응답 형식 (이 함수 → 프론트엔드):
 *   200 { ok:true, result: { ...아래 JSON_SCHEMA 참고... } }
 *   4xx/5xx { ok:false, error: "설명" }
 *
 * 외부 의존성 없이 Node 18+ 내장 fetch만 사용합니다(별도 npm install 불필요).
 */

const OPENAI_MODEL = 'gpt-4o-audio-preview';

// SMMS 프론트엔드의 "AI 보컬 분석 리포트" 화면(vreportTab* 함수들)이 기대하는 항목과
// 1:1로 맞춘 JSON 스키마입니다. 영문 키를 쓰는 이유는 OpenAI Structured Outputs가
// 스키마 검증에 안정적이기 때문이며, 프론트엔드에서 한글 라벨로 매핑해 렌더링합니다.
const JSON_SCHEMA = {
  name: 'vocal_analysis_report',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      overall: {
        type: 'object', additionalProperties: false,
        properties: {
          total: { type: 'integer', minimum: 0, maximum: 100 },
          voice: { type: 'integer', minimum: 0, maximum: 100 },
          pitch: { type: 'integer', minimum: 0, maximum: 100 },
          rhythm: { type: 'integer', minimum: 0, maximum: 100 },
          breath: { type: 'integer', minimum: 0, maximum: 100 },
          expression: { type: 'integer', minimum: 0, maximum: 100 },
        },
        required: ['total', 'voice', 'pitch', 'rhythm', 'breath', 'expression'],
      },
      voiceProduction: {
        type: 'object', additionalProperties: false,
        properties: {
          vocalCordContact: { type: 'integer', minimum: 0, maximum: 100 },
          vocalCordPressure: { type: 'integer', minimum: 0, maximum: 100 },
          breathSupport: { type: 'integer', minimum: 0, maximum: 100 },
          consistency: { type: 'integer', minimum: 0, maximum: 100 },
          soundDensity: { type: 'integer', minimum: 0, maximum: 100 },
          stability: { type: 'integer', minimum: 0, maximum: 100 },
        },
        required: ['vocalCordContact', 'vocalCordPressure', 'breathSupport', 'consistency', 'soundDensity', 'stability'],
      },
      pitchDetail: {
        type: 'object', additionalProperties: false,
        properties: {
          avg: { type: 'integer', minimum: 0, maximum: 100 },
          start: { type: 'integer', minimum: 0, maximum: 100 },
          sustain: { type: 'integer', minimum: 0, maximum: 100 },
          end: { type: 'integer', minimum: 0, maximum: 100 },
          deviationCents: { type: 'integer', minimum: 0, maximum: 100 },
          tendency: { type: 'string', enum: ['플랫', '샤프', '중립', '플랫(고음부)', '샤프(고음부)'] },
        },
        required: ['avg', 'start', 'sustain', 'end', 'deviationCents', 'tendency'],
      },
      rhythmDetail: {
        type: 'object', additionalProperties: false,
        properties: {
          accuracy: { type: 'integer', minimum: 0, maximum: 100 },
          entryTiming: { type: 'string' },
          phraseEnd: { type: 'integer', minimum: 0, maximum: 100 },
          tempoStability: { type: 'integer', minimum: 0, maximum: 100 },
        },
        required: ['accuracy', 'entryTiming', 'phraseEnd', 'tempoStability'],
      },
      range: {
        type: 'object', additionalProperties: false,
        properties: {
          lowestNote: { type: 'string' },
          highestNote: { type: 'string' },
          mainRange: { type: 'string' },
          safeRange: { type: 'string' },
          songRequiresNote: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['lowestNote', 'highestNote', 'mainRange', 'safeRange', 'songRequiresNote', 'note'],
      },
      breathDetail: {
        type: 'object', additionalProperties: false,
        properties: {
          length: { type: 'integer', minimum: 0, maximum: 100 },
          phraseSupport: { type: 'integer', minimum: 0, maximum: 100 },
          breakCount: { type: 'integer', minimum: 0, maximum: 20 },
          position: { type: 'string' },
          efficiency: { type: 'integer', minimum: 0, maximum: 100 },
        },
        required: ['length', 'phraseSupport', 'breakCount', 'position', 'efficiency'],
      },
      resonanceDetail: {
        type: 'object', additionalProperties: false,
        properties: {
          nasal: { type: 'integer', minimum: 0, maximum: 100 },
          oral: { type: 'integer', minimum: 0, maximum: 100 },
          chest: { type: 'integer', minimum: 0, maximum: 100 },
          head: { type: 'integer', minimum: 0, maximum: 100 },
        },
        required: ['nasal', 'oral', 'chest', 'head'],
      },
      timbre: {
        type: 'object', additionalProperties: false,
        properties: {
          brightness: { type: 'integer', minimum: 0, maximum: 100 },
          warmth: { type: 'integer', minimum: 0, maximum: 100 },
          clarity: { type: 'integer', minimum: 0, maximum: 100 },
          thickness: { type: 'integer', minimum: 0, maximum: 100 },
          roughness: { type: 'integer', minimum: 0, maximum: 100 },
          breathiness: { type: 'integer', minimum: 0, maximum: 100 },
        },
        required: ['brightness', 'warmth', 'clarity', 'thickness', 'roughness', 'breathiness'],
      },
      diction: {
        type: 'object', additionalProperties: false,
        properties: {
          consonant: { type: 'integer', minimum: 0, maximum: 100 },
          vowelHold: { type: 'integer', minimum: 0, maximum: 100 },
          delivery: { type: 'integer', minimum: 0, maximum: 100 },
          consistency: { type: 'integer', minimum: 0, maximum: 100 },
        },
        required: ['consonant', 'vowelHold', 'delivery', 'consistency'],
      },
      expression: {
        type: 'object', additionalProperties: false,
        properties: {
          dynamics: { type: 'integer', minimum: 0, maximum: 100 },
          volumeChange: { type: 'integer', minimum: 0, maximum: 100 },
          emotionCurve: { type: 'string' },
          phrasing: { type: 'integer', minimum: 0, maximum: 100 },
          diversity: { type: 'integer', minimum: 0, maximum: 100 },
          sadness: { type: 'string' },
          tension: { type: 'string' },
          energy: { type: 'string' },
        },
        required: ['dynamics', 'volumeChange', 'emotionCurve', 'phrasing', 'diversity', 'sadness', 'tension', 'energy'],
      },
      highlights: {
        type: 'array', minItems: 3, maxItems: 6,
        items: {
          type: 'object', additionalProperties: false,
          properties: {
            approxTimeLabel: { type: 'string', description: '예: "도입부", "1분대", "후렴 클라이맥스", "아웃트로" 등 대략적 위치 — 정밀 초 단위 타임코드가 아님' },
            text: { type: 'string' },
            tag: { type: 'string', enum: ['good', 'warn', 'alert'] },
          },
          required: ['approxTimeLabel', 'text', 'tag'],
        },
      },
      strengths: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'string' } },
      improvements: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'string' } },
      practice: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'string' } },
      vocalComment: { type: 'string' },
      overallReview: { type: 'string' },
      vocalStyleNote: { type: 'string' },
      songFit: {
        type: 'object', additionalProperties: false,
        properties: {
          recommendedArtists: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 6 },
          notRecommendedArtists: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
          notRecommendedReason: { type: 'string' },
        },
        required: ['recommendedArtists', 'notRecommendedArtists', 'notRecommendedReason'],
      },
    },
    required: [
      'overall', 'voiceProduction', 'pitchDetail', 'rhythmDetail', 'range', 'breathDetail',
      'resonanceDetail', 'timbre', 'diction', 'expression', 'highlights',
      'strengths', 'improvements', 'practice', 'vocalComment', 'overallReview',
      'vocalStyleNote', 'songFit',
    ],
  },
};

const SYSTEM_PROMPT = `당신은 보컬 트레이너 자격을 가진 AI 보컬 분석 엔진입니다.
첨부된 노래 녹음을 청취 기반으로 평가하고, 반드시 주어진 JSON 스키마 형식으로만 응답합니다.
반주가 섞인 믹스 트랙일 수 있다는 점을 감안해 판단하세요. 확신이 낮은 값은 range.note, vocalComment 등
서술형 필드에 그 불확실성을 명시하세요(예: "반주가 섞여 있어 추정치입니다"). 점수는 0~100 사이 정수이며
너무 극단적인 값(0, 100)은 실제로 그럴 만한 근거가 있을 때만 사용하세요. 모든 서술형 텍스트는 한국어로,
구체적이고 실행 가능한 코칭 관점으로 작성하세요.`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST 요청만 허용됩니다.' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // 서버에 키가 설정되지 않은 경우 — 여기서 절대 하드코딩된 키로 대체하지 않는다.
    res.status(500).json({ ok: false, error: 'OPENAI_API_KEY 환경 변수가 설정되어 있지 않습니다. Vercel 프로젝트 설정에서 등록해주세요.' });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    res.status(400).json({ ok: false, error: '요청 본문(JSON) 파싱에 실패했습니다.' });
    return;
  }

  const { audioBase64, mimeType, songTitle } = body || {};
  if (!audioBase64) {
    res.status(400).json({ ok: false, error: 'audioBase64 필드가 필요합니다.' });
    return;
  }

  // gpt-4o-audio-preview가 인식하는 포맷은 wav/mp3 등 — mimeType에서 형식을 추출한다.
  const format = (mimeType || 'audio/mpeg').includes('wav') ? 'wav' : 'mp3';

  const payload = {
    model: OPENAI_MODEL,
    modalities: ['text'],
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: `다음은 "${songTitle || '제출된 곡'}"을 부른 보컬 녹음입니다. 스키마에 맞춰 분석해주세요.` },
          { type: 'input_audio', input_audio: { data: audioBase64, format } },
        ],
      },
    ],
    response_format: { type: 'json_schema', json_schema: JSON_SCHEMA },
  };

  let openaiRes;
  try {
    openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'OpenAI API 호출 자체가 실패했습니다: ' + e.message });
    return;
  }

  if (!openaiRes.ok) {
    const errText = await openaiRes.text().catch(() => '');
    res.status(openaiRes.status).json({ ok: false, error: `OpenAI API 오류 (${openaiRes.status}): ${errText.slice(0, 500)}` });
    return;
  }

  const data = await openaiRes.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    res.status(502).json({ ok: false, error: 'OpenAI 응답에서 결과 내용을 찾지 못했습니다.' });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    res.status(502).json({ ok: false, error: 'OpenAI가 반환한 JSON을 파싱하지 못했습니다.' });
    return;
  }

  res.status(200).json({ ok: true, result: parsed });
};
