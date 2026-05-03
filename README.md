# AuctionFlow Pro

다가구 등 **법원 경매 물건**을 단계별로 관리하고, 강의 노트·체크리스트·템플릿을 로컬에 저장하는 Next.js 앱입니다.

## 기능 개요

| 영역 | 설명 |
|------|------|
| **대시보드 / 물건** | 사건별 상태, 체크리스트, 입찰 회차, 메모. 기본: 물건 유형·**준공년도**, 면적·주차·위반, **건폐율·용적율·말소기준**(문자·템플릿 `{건폐율}` 등) |
| **임대세팅** | **앰버**: 핵심 입력, **입찰·낙찰 감정가 대비 %**(낙찰가는 도구 탭 입력 또는 판단 기록 실입찰가). 탭 전환 시 **기본 탭 미저장 초안**(감정가·면적 입력칸 등)까지 반영해 계산. 호실 표는 투자 **계산 결과** 바로 아래. 문자 미리보기도 동일 병합 물건 기준으로 `{감정가}`·`{감정가대비낙찰가}` 계산(기본 감정가 없으면 임대세팅 감정가 보조) |
| **프로세스** | 단계별 **체크리스트 템플릿** 편집 + **강의 노트**(단계별 문자열, 로컬 저장) |
| **공부하기 (`/study`)** | 요약본을 문서 미리보기 형태로 연속 열람, **원본 DOCX 다운로드** |
| **데이터** | 메시지 템플릿 등 부가 데이터 |

### 강의 요약본과 원본 파일

- **요약본**은 `src/lib/data/lecture-guide.ts`의 `LECTURE_BLOCKS_BY_STEP`에 단계(`CaseStatus`)별 블록으로 들어 있습니다.  
  프로세스 화면의 기본 강의 노트·공부하기 미리보기가 같은 내용을 사용합니다.
- 사용자가 프로세스에서 저장한 내용은 **`lectureGuideByStep`**(앱 데이터)에 덮어쓰며, 해당 단계에는 저장본이 우선합니다.
- **원본 DOCX**는 `public/lectures/originals/`에 두며, 메타데이터는 `src/lib/data/lecture-sources.ts`의 `LECTURE_ORIGINAL_DOCS`와 맞춥니다.  
  새 파일을 넣을 때는 폴더에 복사한 뒤 `lecture-sources.ts`에 항목을 추가하면 공부하기 페이지에 링크가 표시됩니다.

포함된 원본 예시(파일명):

- `곰물주_경매_강의노트_정리본.docx`
- `대출1강_1교시_정리본.docx`
- `명도_실무_매뉴얼_상세.docx`
- `명도1강_1교시_정리본.docx` · `명도1강_2교시_정리본.docx` · `명도1강_3교시_정리본.docx`

## 테마 (밝은 배경 / 어두운 배경)

- **밝게**: 밝은 회색 페이지 배경(`#f4f4f5`), 본문 대비용 표면색 변수 사용.
- **어둡게**: 짙은 배경(`#09090b`)과 대비되는 전경·테두리 변수 사용.
- **시스템**: OS의 `prefers-color-scheme`을 따릅니다.

설정은 헤더 오른쪽 토글에서 바꾸며, 브라우저 **`localStorage` 키 `auctionflow-theme`**에 `light` / `dark` / `system`으로 저장됩니다.  
첫 페인트 깜빡임을 줄이기 위해 `src/components/theme-script.tsx`가 페이지 로드 전에 `html`에 `dark` 클래스를 적용합니다.

스타일 진입점은 `src/app/globals.css`이며, Tailwind v4에서 **`@custom-variant dark`**로 `html.dark` 하위에 `dark:` 유틸이 동작하도록 했습니다.

## 개발

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

```bash
npm run build
npm start
```

## 스택

- Next.js (App Router), React, TypeScript  
- Tailwind CSS v4, Zustand(로컬 상태·저장)

## 배포

[Vercel](https://vercel.com) 등 일반적인 Next.js 호스팅에 배포할 수 있습니다.  
원본 DOCX를 레포에 포함할지는 저장소 크기 정책에 따라 선택하면 됩니다.
# Auction
