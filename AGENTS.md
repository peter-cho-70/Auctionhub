<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 사용자 데이터 보호 (필수)

브라우저 `localStorage` + IndexedDB에 물건·PDF·분석 데이터가 저장됩니다. **코드 변경 시 데이터가 삭제·덮어쓰기되지 않도록** 다음을 지킵니다.

- `resetToDefaults`, `importData(..., "replace")`, 시드 자동 로드, 용량 압축 등 **파괴적 변경 전** `snapshotBeforeDestructiveChange` 또는 `saveLocalDataSnapshot` 호출
- 빈 물건 목록일 때 **시드 데이터를 자동 주입하지 않음** — `shouldAutoLoadBundledSeed()` 통과 시에만 (`hadUserDataBefore`·스냅샷 있으면 금지)
- `ensureAppData` / 마이그레이션에서 물건 배열을 임의로 비우거나 `createDefaultAppData()`로 대체하지 않음
- 용량 절약 시 `sourceDocuments` 전체 삭제·`stripExtractedText`는 **스냅샷 후**에만, 물건이 있을 때만
- 테스트·리팩터 시 `public/seed/app-data.json`을 프로덕션 데이터 대체용으로 쓰지 않음
- 복구: **데이터** 탭 → 로컬 스냅샷 복원 / JSON 가져오기 / 백업 물건 복원
