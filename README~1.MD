# SMMS 보컬 분석 백엔드 배포 방법

이 폴더는 OpenAI API 키를 안전하게 서버 쪽에 보관하기 위한 최소한의 서버리스 함수입니다. 별도로 서버를 직접 운영·관리할 필요 없이 Vercel에 올리면 바로 동작합니다.

## 왜 이게 필요한가

브라우저에서 실행되는 HTML 파일에 API 키를 직접 넣으면 누구나 페이지 소스에서 키를 볼 수 있습니다. 이 폴더의 함수는 그 대신 서버(Vercel)에서만 키를 보관하고, 브라우저는 이 함수를 호출해 결과만 받아옵니다.

## 배포 절차 (최초 1회)

1. [vercel.com](https://vercel.com)에 GitHub 계정으로 가입/로그인합니다.
2. 이 `SMMS_backend` 폴더를 본인 GitHub 저장소에 올립니다(새 저장소 하나 만들어서 이 폴더 안의 파일들만 커밋하면 됩니다).
3. Vercel 대시보드에서 **Add New → Project** → 방금 만든 저장소 선택 → Import.
4. 배포 설정 화면에서 **Environment Variables**에 다음을 추가합니다.
   - Key: `OPENAI_API_KEY`
   - Value: OpenAI에서 새로 발급받은 키 (이전에 대화창에 붙여넣으셨던 키는 이미 노출된 것으로 간주하고 반드시 폐기 후 새로 발급받은 키를 쓰세요)
5. **Deploy** 클릭. 완료되면 `https://프로젝트이름.vercel.app` 형태의 주소가 발급됩니다.
6. 실제 엔드포인트 주소는 `https://프로젝트이름.vercel.app/api/analyze-vocal` 입니다.

## 프론트엔드(HTML)와 연결하기

`SMMS_v12_connected_flow.html` 상단 근처에 `const VOCAL_ANALYSIS_API_URL = '';` 로 되어 있는 부분을 배포된 주소로 바꿔주세요.

```js
const VOCAL_ANALYSIS_API_URL = 'https://프로젝트이름.vercel.app/api/analyze-vocal';
```

비워두면(빈 문자열) 기존처럼 데모용 시뮬레이션 결과가 나오고, 주소를 채워두면 실제 OpenAI 분석 결과가 표시됩니다. 즉 백엔드를 아직 안 올린 상태에서도 파일은 그대로 데모로 동작합니다.

## CLI로 배포하는 방법 (선택)

GitHub 없이 터미널에서 바로 배포하려면:

```bash
cd SMMS_backend
npm install -g vercel   # 최초 1회
vercel login
vercel                  # 프로젝트 생성/배포
vercel env add OPENAI_API_KEY   # 여기서 키를 입력 (터미널 입력은 화면에 안 남습니다)
vercel --prod
```

## 확인 방법

배포 후 아래처럼 호출해보면 정상 동작 여부를 바로 확인할 수 있습니다 (오디오 없이 호출하면 400 에러가 정상입니다 — 엔드포인트가 살아있다는 뜻입니다).

```bash
curl -X POST https://프로젝트이름.vercel.app/api/analyze-vocal \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 비용 관련 참고

`gpt-4o-audio-preview` 모델은 오디오 입력 분량에 비례해 과금됩니다. 3~4분짜리 노래 한 곡 분석에 어느 정도 비용이 드는지는 OpenAI 요금 페이지에서 최신 단가를 확인하시길 권합니다(모델 가격은 자주 바뀝니다). 데모/시연 목적이라면 파일을 미리 30초~1분 정도로 잘라서 테스트하면 비용을 아낄 수 있습니다.

## 보안 체크리스트

API 키를 코드, 커밋 메시지, 이 README, 대화창 등 어디에도 평문으로 남기지 마세요. `.env.example`은 예시일 뿐 실제 값을 넣는 파일이 아닙니다. 이전에 대화창에 붙여넣으신 키는 지금 바로 OpenAI 대시보드에서 폐기하고 새 키로 교체해주세요.
