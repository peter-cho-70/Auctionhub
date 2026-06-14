# 주소·공공 API 연동

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `JUSO_CONF_KEY` | 주소 검색 | [도로명주소 개발자센터](https://www.juso.go.kr/addrlink/devAddrLinkRequestWrite.do?cType=DEV) 승인키 |
| `MOLIT_API_KEY` | 주변 시세 | [공공데이터포털](https://www.data.go.kr) 국토부 실거래 API |
| `NAVER_MAP_CLIENT_SECRET` | 지도 좌표 | Geocoding (Secret **전체** 복사) |
| `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` | 지도·Geocoding ID | Maps Application Client ID |

`cp .env.example .env.local` 후 키를 채우고 `npm run dev`를 재시작하세요.

## 주소 검색 (행안부)

- API: `GET /api/address/search?keyword=...` (서버가 `JUSO_CONF_KEY`로 [addrLinkApi](https://business.juso.go.kr/addrlink/addrLinkApi.do) 호출)
- UI: 물건 **기본정보**·**새 물건**의 「표준 주소 검색」
- 선택 시 `AuctionCase.addressMeta`에 법정동코드·PNU·대전 `molitLawdCode` 저장

## 주변 시세 (MOLIT)

- `addressMeta.molitLawdCode`가 있으면 구 이름 추정보다 우선 사용
- 대전 5개 구만 `LAWD_CD` 매핑 (`src/lib/address/lawd-code.ts`)

## 외부 링크

- `GET /api/address/geocode?address=&road=&jibun=&entX=&entY=` — 행안부 UTM-K(`entX`/`entY`)→WGS84 우선, 네이버 Geocoding 보조
- 네이버 부동산 URL: `ms`+`cortarNo`(법정동 10자리), 좌표 있을 때 `query` 생략
- **네이버 지도 → 부동산**: 좌표 확인 후 지도 탭 → 약 3.2초 뒤 **원룸·투룸·다가구** 부동산 지도
- 좌표는 주변 시세 `lat`/`lng` 또는 Geocoding 결과 사용
- `addressMeta.pnu`가 있으면 **토지이음** 도시계획 상세 링크 표시

## 주변 시세 (MOLIT)

- 매매 **120개월** + 전월세 **12개월** 구 단위 수집
- `AppData.guMarketCache` — 같은 구 재조회 시 API 생략
- 월세·전세 탭: 표시만 **3 / 6 / 12개월** 필터

## 토지이용규제

- `GET /api/land/use-regulation?pnu=` (PNU 19자리)
- `DATA_GO_KR_SERVICE_KEY` 또는 `MOLIT_API_KEY` (공공데이터포털 토지이용규제 활용신청)
