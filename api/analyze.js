export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server API key not configured' });
  try {
    const { images } = req.body;
    if (!images || !images.length) return res.status(400).json({ error: 'No images provided' });
    const imgContent = images.map(img => ({ type: "image", source: { type: "base64", media_type: img.mediaType || "image/jpeg", data: img.data } }));
    const prompt = `당신은 한국 주식 종가베팅 전문 분석가입니다. 첨부된 HTS/MTS 차트 이미지를 분석하고 아래 JSON 형식으로만 응답하세요.
## 매매가이드 기반 분석 원칙
### 돌파봉 분석
- 전고점(매물대) 대비 현재가 위치 확인
- 돌파봉 중심선 = (시가+종가)/2 -> 핵심 지지선
- 위꼬리 비율: 전체 봉 길이 대비 위꼬리 10% 이내여야 진짜 돌파
- 거래대금: 20일 평균 대비 3배 이상이면 유효 돌파
### 눌림목 시나리오 판별
- A시나리오(재돌파): 돌파봉 종가까지 눌렸다가 다시 돌파 -> 매수가=돌파봉종가+0.5%, 손절=중심선-2%
- B시나리오(중심선지지): 중심선 부근 거래량감소+양봉 -> 매수가=중심선+/-1%, 손절=시가-2%
- C시나리오(20선지지): 20MA 지지+거래량바닥후반등 -> 매수가=20MA+1%, 손절=20MA-3%
### 매도 기준
- 돌파봉 종가매수: +5% 1/3매도, +9%갭상승 전량매도, +10~15% 1/3매도, 전고점 잔량매도
- 눌림목 매수: 돌파봉종가회복 1/3, 전고점 1/3, 신고가+3% 잔량매도
- 손절: 돌파봉 중심선-2% or 진입가-3~5%
### 8조건 체크
1.주도테마대장주 2.정배열 3.신고가근접 4.거래대금폭증 5.위꼬리10%이내 6.저점미이탈 7.외인기관순매수 8.섹터상대강도상위
## 응답 JSON:
{"stockName":"종목명","date":"분석일","checklist":[{"label":"항목명","pass":true,"detail":"설명"}],"analysis":"종합 분석 3~5문장","verdict":"최종 판단","tradingGuide":{"breakout":"돌파봉 분석","pullback":"눌림목 시나리오","sellPlan":"매도 계획","conditions":"8조건 체크","finalVerdict":"최종 판정"}}
체크리스트 6가지: 거래대금, 매물대 돌파/이격, 정배열, 캔들 패턴, 기간조정, 수급 동향. 순수 JSON만 출력.`;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000, messages: [{ role: "user", content: [...imgContent, { type: "text", text: prompt }] }] })
    });
    if (!response.ok) { const err = await response.json().catch(() => ({})); return res.status(response.status).json({ error: err.error?.message || "API error" }); }
    const data = await response.json();
    const text = data.content?.map(c => c.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };
