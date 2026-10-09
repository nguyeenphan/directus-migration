# Audit toàn bộ project — 2026-10-09

Ghi chú để dựa vào đó fix và optimize. Phạm vi: toàn bộ `src/` (trừ `components/ui` vendored và `showcase`).

**Cách kiểm tra:** đọc code tĩnh + chạy `npm test` (152/152 pass), `tsc --noEmit` (sạch), `eslint` (sạch), `npm run build` (pass, 1 warning — xem D2). **Chưa chạy với Directus thật**, nên các mục ghi "cần xác minh" là suy ra từ code và từ hành vi Directus mà mình nhớ, chưa quan sát trực tiếp.

**Bối cảnh kiến trúc cần nhớ khi đọc các mục dưới:** toàn bộ runner chạy **trong tab trình duyệt** (`operations.ts` không có `'use server'`, `clientFor` dùng `window.location.origin`, store là `globalThis` của tab). Server chỉ là proxy `/api/directus`. Backup, secrets và trạng thái run đều nằm trong bộ nhớ tab.

Mức độ: **P0** = mất/sai dữ liệu hoặc báo kết quả sai · **P1** = bug chức năng rõ ràng · **P2** = nhỏ / hardening.

## Trạng thái sau lượt fix (2026-10-10)

Kiểm chứng: 180/180 test pass (thêm bộ test runner chạy trên Directus giả trong bộ nhớ — `src/tests/runner.test.ts`, `src/tests/support/fakeDirectus.ts`), `tsc`, `eslint`, `next build` sạch. Đã chạy tay cả luồng trên trình duyệt qua proxy thật với hai Directus giả qua HTTP: connect → plan → apply → chặn tải backup → ghi → rollback → recompare → kịch bản target trả 503 → Run again. **Vẫn chưa chạy với Directus thật.**

### Đã sửa
B1 (theo hướng khác, xem dưới), B2, B3, B4, B5, B6, B7, B8, B9.1, B9.3, B10, B11 (theo hướng khác), B12, B14, B15 (một phần), B16 (phần `readColumns`), B17, B18, B19, B20, B21 (phần chặn trước khi ghi), B22, B23, B24, B25, B26, B28, B32, B36 · O1, O2, O4, O5, O6, O9, O10, O11, O12 · các React nit (trừ `useMemo` thừa) · D1, D2, D4.

### Bug mới phát hiện khi chạy thử, đã sửa
- **B37.** `describe()` trong `utils/result.ts`, `runner.ts`, `probe.ts` destructure `error.errors` như mảng. Khi upstream trả về thứ SDK không parse được (HTML 502, body rỗng…), `errors` là chuỗi hoặc `SyntaxError` → ném `TypeError` ngay trong `catch` → sập cả trang ("This page couldn't load"), và trong runner thì run kết thúc mà không ghi nhận lỗi. → gom về `src/utils/describeError.ts`, có test.
- **B38.** Hai schema giống hệt nhau → `/schema/diff` trả 204 không body → SDK trả về đối tượng `Response` chứ không phải `null` → `buildSchemaPlan` đọc `.collections` của `undefined`. → `schema.ts` coi mọi phản hồi không có `diff` là "không khác gì".

### Chạy thật với Directus (2026-10-10): source `directus.dop.geekup.io` (chỉ đọc) → đích local `0.0.0.0:8055` (trống)
Kết quả: schema 116 collection + 281 relation áp xong trong 4s, so lại không còn diff; data ghi 10.594/10.595 dòng trong 91s; so lại chỉ còn 1 dòng (`documentInfo`, xem B43). Các lỗi lộ ra khi chạy thật, đã sửa:
- **B39. "Invalid payload. request entity too large."** Directus mặc định `MAX_PAYLOAD_SIZE=1mb` cho body JSON; snapshot schema lớn hơn thế. → `src/lib/directus/schemaTransfer.ts` gửi snapshot/diff dạng file upload (không bị ngưỡng này); batch ghi dữ liệu bị từ chối vì quá lớn thì tự chia đôi (`updateRows` trong `runner.ts`).
- **B40. Đọc phân trang treo vô hạn trên collection singleton.** Directus trả đúng một object cho singleton ở mọi `offset`, nên `readPages` không bao giờ gặp trang rỗng. Làm treo dry-run, sinh SQL, xem diff record (và backup/pass 1 của runner cũ). → sửa trong `paging.ts`.
- **B41. Header upload dùng chung bị SDK xoá sau lần gọi đầu** → lần diff thứ hai lại gửi sai kiểu. → tạo header mới mỗi request.
- **B42. "Service api is unavailable. Under pressure."** khi so sánh song song. → retry theo từng trang đọc (`paging.ts`), `RETRY_ATTEMPTS` 3→5, `COMPARE_CONCURRENCY` 4→2 vì source thường là production.
- **Thêm `DIRECTUS_READONLY_HOSTS`**: proxy từ chối mọi request không phải GET/HEAD tới các host này, nên source production không thể bị ghi dù bấm nhầm hay có bug. Đang bật cho `directus.dop.geekup.io` trong `.env.local`.

**B43 (không phải lỗi của app, chưa xử lý):** `documentInfo.documentTemplates` trên source là field alias `o2m` mồ côi — không relation nào trỏ tới nó (relation thật dùng `one_field: templates`). Directus coi nó như cột thật khi cập nhật singleton nên `PATCH /items/documentInfo` lỗi "column documentInfo.documentTemplates does not exist". Schema được migrate nguyên trạng nên đích cũng lỗi y vậy. Cách xử lý: xoá field mồ côi đó (trên source, hoặc trên đích rồi chạy lại data).

### Làm khác với đề xuất ban đầu — có lý do
- **B1 (rollback + file/folder):** không xoá file/folder run đã tạo. Xoá file qua Directus sẽ xoá luôn bytes trong storage, mà storage dùng chung với source. Rollback giờ bỏ qua system collection và ghi log rõ.
- **B11 (dòng stub):** không tự xoá stub. Nếu có FK `ON DELETE CASCADE`, xoá stub có thể kéo theo các dòng run vừa ghi. Thay vào đó: unit bị đánh `failed` kèm số dòng stub, constraint không khôi phục được hiện banner ngay ở màn hình run; "Run again" lấp stub, "Roll back" xoá stub, cả hai đều khôi phục constraint gốc.
- **B33 (chỉ copy file được tham chiếu):** **không làm.** Rich text nhúng file theo id, không có relation để lần theo; chỉ copy file được tham chiếu sẽ làm mất ảnh trong nội dung. Giữ copy toàn bộ; chỉ thêm: ghi `createdKeys` từng file, và dừng trước stage data nếu stage files lỗi.
- **Rollback** giờ dựa trên trạng thái: so backup với target hiện tại rồi ghi lại phần khác, nên rollback lỗi giữa chừng chạy lại được.

### Giữ nguyên theo chủ đích của chủ dự án
- **SQL script không bọc transaction** (B13). Phần còn lại của B13 cũng để nguyên: stage 1 vẫn insert stub chỉ có PK, stage 3 xoá không theo thứ tự phụ thuộc. Đã sửa hai lỗi không liên quan chủ đích đó: field `csv` ghi đúng dạng `a,b`; thêm dòng cảnh báo khi vendor không phải Postgres.
- **Gửi `null` cho 4 cột audit** (`user_created`, `user_updated`, `date_created`, `date_updated`) trên các dòng được ghi là chủ đích (B9.2) — đã xác nhận 2026-10-10. Dòng không đổi thì không bị đụng tới.
- **Nút Retry** dùng để chạy lại khi server quá tải; **Recompare** dùng để kiểm tra diff đã hết sau khi migrate.

### Chưa làm — cần bạn quyết định hoặc cần Directus thật để kiểm chứng
- **B21 follow-up — rollback từ file backup đã tải.** File hiện chỉ dùng được bằng tay sau khi reload.
- **B15:** số trong dialog xác nhận giờ là **cận trên** (khớp với việc run chỉ ghi dòng mới/đổi; bản ghi bị bỏ tick chỉ làm giảm). Con số chính xác cần dry-run so nội dung.
- **O3 — keyset pagination.** Sai một ly ở phân trang là mất dữ liệu hoặc mirror xoá nhầm; không sửa khi chưa thử được trên Directus thật.
- **B16 (phần còn lại):** mọi 403 vẫn bị coi là "collection chưa có".
- **B27, B29, B30, B31, B34, B35, O7, O8, D3** và các `useMemo` thừa: chưa đụng.

---

## P0 — Sai dữ liệu, mất dữ liệu, báo kết quả sai

### B1. Rollback hỏng hoàn toàn khi run đã tạo file/folder
- **Ở đâu:** `src/lib/directus/runner.ts:855-862` (xoá `createdKeys`), `:397`, `:428` (ghi `directus_folders` / `directus_files` vào `createdKeys`).
- **Chuyện gì xảy ra:** rollback gọi `deleteItems(collection, batch)` cho mọi key trong `createdKeys`. SDK chặn core collection: `deleteItems('directus_files', …)` ném `"Cannot use deleteItems for core collections"` (đã xác nhận trong `node_modules/@directus/sdk/dist/index.js`). Folder/file được ghi vào `createdKeys` **đầu tiên**, nên rollback ném lỗi ngay vòng lặp đầu, **chưa khôi phục được dòng nào**.
- **Fix:** tách nhánh cho system collection: dùng `deleteFiles` / `deleteFolders` (hoặc `customEndpoint` DELETE). Xoá file trước folder, và xoá sau khi đã khôi phục dữ liệu (để không còn dòng nào trỏ tới).

### B2. Rollback sau một lần restore constraint thất bại sẽ làm mất định nghĩa constraint gốc
- **Ở đâu:** `runner.ts:845-852` và `:903-904`; `src/lib/store/constraints.ts:48-49`.
- **Chuyện gì xảy ra:** nếu `restoreConstraints` của run thất bại (xem B11), bản ghi pending-relax (giữ `meta`/`schema` gốc) còn nằm trong localStorage dưới `run.id`. Khi user bấm Rollback, `rollbackRun` gọi `planRelax` trên target **đang ở trạng thái đã nới** → các field đó không còn bị coi là "cần nới" → danh sách gần như rỗng. `putPendingRelax` cùng `runId` **ghi đè** bản ghi cũ, rồi `finally` gọi `clearPendingRelax`. Kết quả: NOT NULL / UNIQUE / required gốc mất vĩnh viễn (chỉ còn trong `backup.snapshot` nếu tab chưa đóng).
- **Fix:** trước khi `planRelax`, đọc pending-relax đang tồn tại cho `targetHost`; nếu có thì **dùng lại** bản gốc đó thay vì plan mới, và không bao giờ ghi đè một entry bằng danh sách nghèo hơn. Áp dụng cho cả run mới trên cùng target.

### B3. Run báo `succeeded` khi stage data bị crash
- **Ở đâu:** `runner.ts:192-196` (catch ngoài cùng chỉ log), `:808-819` (`finish` chỉ đếm unit `failed`).
- **Chuyện gì xảy ra:** mọi lỗi ném ra ngoài vòng lặp theo unit — `schemaSnapshot` đầu run (`:165`), `readColumns`/`planRelax`/`applyRelax`/`expandRecordPicks` trong `copyData`, và đặc biệt `restoreConstraints` trong `finally` (`:655`) — chỉ được log. Không unit nào bị đánh `failed` → `failed === 0` → status `succeeded`, kể cả khi constraint còn đang bị nới hoặc không dòng nào được ghi.
- **Fix:** thêm cờ lỗi cấp run (`run.fatalError`), `finish` trả `failed`/`partial` khi có cờ; unit data còn `pending`/`running` phải được đánh dấu rõ. Restore thất bại phải là trạng thái riêng, hiển thị nổi bật (xem B20).

### B4. Bỏ chọn một record có thể âm thầm loại hàng loạt record khác khỏi migration
- **Ở đâu:** `src/app/[lang]/migrate/components/data/dataStep.tsx:119-136`; `src/lib/directus/detail.ts:66` (`.slice(0, MAX_DETAIL_RECORDS)` = 500), `detail.ts:233` (bỏ field `hidden`).
- **Chuyện gì xảy ra:** picks lưu dạng **danh sách được chọn**, lấy từ `browser.records` — danh sách này (a) bị cắt còn 500 thay đổi đầu, (b) không chứa record chỉ khác ở field hidden. Khi chưa đụng gì thì `records[collection]` không tồn tại = "tất cả" → đúng. Nhưng chỉ cần bỏ tick **một** record trong collection có 2.000 thay đổi, picks thành 499 key → run chỉ ghi 499 record, 1.500 record còn lại bị bỏ mà UI không báo gì (không có thông báo "đã cắt bớt" ở danh sách record).
- **Fix (gốc rễ):** đổi picks sang dạng **loại trừ** (`excluded: Set<key>`), "tất cả trừ những cái đã bỏ". `keepsRow`, `expandPicks`, `mirrorDeletes`, `diffSides`, `dryRun` đổi theo. Đồng thời hiển thị rõ khi danh sách bị cắt ở 500.

### B5. Backup nuốt lỗi đọc nhưng vẫn báo "đã có backup"
- **Ở đâu:** `runner.ts:231-242`.
- **Chuyện gì xảy ra:** `catch {}` trống: mọi lỗi (mạng, timeout, 500) khi đọc một collection → `rows[collection] = []`, `hasBackup = true`. Run vẫn ghi đè collection đó; rollback gặp `rows.length === 0` thì bỏ qua (`:865`). User tưởng có backup nhưng không có.
- **Fix:** chỉ coi là rỗng khi collection thật sự chưa tồn tại (`orMissing`); mọi lỗi khác phải làm backup fail → không ghi gì. Thêm `withRetry`.

### B6. Stepper không bị khoá khi đang chạy data run → mất màn hình run, có thể chạy 2 run chồng nhau
- **Ở đâu:** `src/app/[lang]/migrate/components/migrationWizard.tsx:55-65` (`runInProgress` chỉ xét `schemaRun`); state run của data nằm trong `useApplyRun` bên trong `ApplyStep`.
- **Chuyện gì xảy ra:** trong lúc data run đang chạy, user vẫn bấm được step Schema/Data (hoặc Connect → reset flow). `ApplyStep` unmount → mất `run` → quay lại Apply là form trắng, trong khi `execute()` vẫn chạy nền với constraint đang nới. User có thể bấm Run lần nữa → hai run ghi cùng target đồng thời; run thứ hai `planRelax` trên trạng thái đã nới (liên quan B2).
- **Fix:** đưa state data-run lên `MigrationWizard` (cùng chỗ với `schemaRun`), tính `runInProgress` cho cả hai; `startRun` từ chối khi đã có run đang chạy trên cùng `targetHost`.

### B7. `applyRelax` nằm ngoài `try` → nới dở dang thì không tự khôi phục
- **Ở đâu:** `runner.ts:574` (try bắt đầu ở `:576`), tương tự `:852`.
- **Chuyện gì xảy ra:** `applyRelax` là `Promise.all` nhiều `updateField`. Một cái fail → reject trước khi vào `try` → `finally` không chạy → các field đã nới xong bị bỏ lại. (Pending-relax đã lưu nên banner ở Connect vẫn sửa được, nhưng run không tự dọn.)
- **Fix:** đưa `applyRelax` vào trong `try`.

### B8. `createdKeys` chỉ được ghi sau khi mọi batch thành công
- **Ở đâu:** `runner.ts:751-758` (`insertMissing`), `:393-398` (folders), `:418-429` (files).
- **Chuyện gì xảy ra:** batch 1–2 tạo xong, batch 3 fail → ném lỗi trước khi ghi `createdKeys` → rollback không biết các dòng đã tạo → để lại dòng rác (stub chỉ có PK) trên target.
- **Fix:** ghi key ngay sau mỗi batch/mỗi request thành công.

### B9. Run ghi lại **mọi** dòng của collection được chọn, không chỉ dòng thay đổi — kèm ghi `null` vào 4 cột audit
- **Ở đâu:** `runner.ts:585-589` (đọc toàn bộ source, chỉ lọc theo picks), `:729` (`rows.map(blankAudit)`), `:773-776`.
- **Chuyện gì xảy ra:**
  1. Plan nói "3 thay đổi" nhưng run `updateItemsBatch` toàn bộ N dòng. Mỗi dòng sinh revision/activity và kích hoạt flow/hook trên target. `unit.written` = N, không khớp số trong plan / dialog xác nhận (B15).
  2. `blankAudit` gửi `user_created/date_created/user_updated/date_updated = null` cho **cả những dòng không đổi**. **Cần xác minh trên Directus thật:** theo mình nhớ, special `date-created`/`user-created` chỉ tự điền khi `create`, còn khi `update` thì nhận nguyên giá trị payload → `date_created` và `user_created` của mọi dòng trên target bị xoá thành NULL. (README chỉ nói bỏ `user_*`, không nói gì về ngày.)
  3. Field có special `hash`/`conceal` được API trả về dạng che `**********` → run ghi chuỗi sao đó ngược lại target, và vì ghi mọi dòng nên hỏng ở mọi lần chạy. **Cần xác minh** nếu project có field loại này.
- **Fix:** dùng lại `fingerprint` (như `sqlScript.ts:376` đã làm) để chỉ ghi dòng mới + dòng khác. Quyết định lại chính sách audit: bỏ hẳn key `user_*` khỏi payload thay vì gửi null; giữ `date_*` của source hoặc không gửi. Loại field `hash`/`conceal` khỏi cột được ghi (hoặc cảnh báo).

---

## P1 — Bug chức năng

### B10. ✅ ĐÃ SỬA — Nút Retry trên màn hình data run không làm gì
- **Ở đâu:** `components/apply/applyStep.tsx:80-90` và `:196`.
- `onRetry={applyRun.apply}` chỉ bật `needsConfirmation`, nhưng `ConfirmWriteDialog` chỉ được render ở nhánh return thứ hai; nhánh `if (applyRun.run) return <RunView/>` không có dialog. (Schema run thì chạy được vì dialog nằm ở wizard.)
- **Mục đích của nút (theo chủ dự án):** chạy lại khi server quá tải — nút cần thiết, lỗi chỉ là bấm không ra dialog.
- **Đã làm:** render `ConfirmWriteDialog` ở cả hai nhánh. Retry tạo run mới → backup mới → lại qua bước tải backup (B21).

### B11. Stop hoặc lỗi giữa pass 1 và pass 2 để lại dòng stub và làm restore constraint fail
- **Ở đâu:** `runner.ts:577-658`.
- Pass 1 tạo dòng chỉ có PK cho mọi collection; nếu stop (`:628`) hoặc `fillCollection` fail, các stub còn nguyên với cột NULL. `restoreConstraints` sau đó `SET NOT NULL` trên cột đang có NULL → fail → dẫn tới B3, B2. README nói "failed run is safe to simply run again" — chỉ đúng nếu lần chạy lại thành công.
- Phụ: unit đã qua pass 1 bị kẹt ở `running` mãi khi stop (`:581` không bao giờ được reset).
- **Fix:** khi dừng/lỗi, xoá các stub đã tạo trong run này mà chưa được fill (đã có `createdKeys`) trước khi restore; hoặc làm từng collection trọn vẹn (insert đủ dòng) và chỉ dùng 2-pass cho FK vòng. Restore tuần tự, `allSettled`, báo field nào fail.

### B12. ✅ ĐÃ SỬA — Diff record bị cũ sau khi Recompare
- **Ở đâu:** `src/hooks/useRecordBrowser.ts:17,46` (cache `details` theo collection, không bao giờ xoá); `DataStep` không remount khi plan đổi.
- Recompare ở step Data tạo plan mới nhưng danh sách record/diff vẫn là bản đọc trước đó.
- **Mục đích của Recompare (theo chủ dự án):** kiểm tra sau khi migrate rằng mọi diff đã biến mất — nên dữ liệu hiển thị sau Recompare bắt buộc phải là bản đọc mới.
- **Đã làm:** `key={plan.generatedAt}` cho `DataStep` và `SchemaStep` trong `migrationWizard.tsx`.
- **Còn lại liên quan mục đích này:** sau một run thành công, Recompare vẫn có thể còn diff ở (a) cột target không có, (b) dòng chỉ-có-ở-target khi không bật mirror, (c) field `hash`/`conceal` không bao giờ hiện diff dù giá trị bị ghi đè (B9.3).

### B13. SQL script dữ liệu: nhiều khả năng không chạy được trên bảng có ràng buộc, và không có transaction
- **Ở đâu:** `src/lib/directus/sqlScript.ts:47-55` (`insertStub`), `:207-248`, `:36-45` (`sqlLiteral`).
- Stage 1 `INSERT (pk)` sẽ fail với mọi bảng có cột NOT NULL không default — đường SQL **không có** bước nới constraint như runner.
- Không có `BEGIN/COMMIT` → lỗi giữa chừng để lại trạng thái dở.
- Stage 3 xoá không theo thứ tự phụ thuộc → vướng FK.
- Field kiểu `csv` (API trả mảng) bị ghi thành chuỗi JSON `'["a","b"]'` thay vì `a,b`; field `hash`/`conceal` ghi `**********`.
- Cú pháp chỉ dành cho Postgres (`ON CONFLICT`, `DO $$`), nhưng UI không ẩn nút với vendor khác (gate chỉ yêu cầu hai bên cùng vendor).
- **Fix:** bọc transaction; insert đủ cột theo thứ tự topo (FK vòng thì UPDATE sau); xoá theo thứ tự ngược; xử lý kiểu theo `special` của field; ẩn/cảnh báo khi vendor ≠ postgres.

### B14. SQL schema: chạy lại sẽ nhân đôi dòng meta
- **Ở đâu:** `src/lib/directus/schemaSql.ts:203-212`.
- `directus_fields` / `directus_relations` chỉ có PK `id` tự tăng, nên `ON CONFLICT DO NOTHING` không bao giờ chặn → chạy script lần 2 tạo trùng meta. (Trong khi `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` thì idempotent.)
- **Fix:** `INSERT … SELECT … WHERE NOT EXISTS (collection, field)`.

### B15. Số liệu ở màn hình xác nhận không khớp việc run sẽ làm; thiếu bước gõ lại host
- **Ở đâu:** `applyStep.tsx:50-68`; `confirmWriteDialog.tsx`; README dòng "every write asks for the target host to be typed back first".
- `counts.records` lấy từ plan (dòng mới + đổi) nhưng run ghi tất cả (B9). Khi có picks, `picked.size` gồm cả key loại `delete`; `deletes` cộng `extraInTarget` của cả collection chứ không theo picks. `counts.sequences` không dùng.
- README mô tả phải gõ lại host target, nhưng dialog chỉ có nút bấm.
- **Fix:** sau khi sửa B9 thì tính số từ cùng một nguồn với runner (tốt nhất lấy từ dry-run); thêm ô gõ host hoặc sửa README.

### B16. `readColumns` nuốt mọi lỗi; mọi 403 đều bị coi là "collection chưa có"
- **Ở đâu:** `src/lib/directus/schema.ts:129-140`; `src/lib/directus/errors.ts:6-17`.
- Lỗi mạng thoáng qua → tập rỗng → "không biết" → bỏ qua kiểm tra cột thiếu → ghi fail khó hiểu hoặc so sánh sai. Token thiếu quyền trên một collection → bị hiểu là collection không tồn tại → mọi record tính là "mới".
- **Fix:** `readColumns` chỉ trả rỗng với 403/404, lỗi khác ném ra (kèm retry). Phân biệt "không tồn tại" bằng danh sách collection của target snapshot thay vì đoán từ 403.

### B17. Retry `createItems` không idempotent
- **Ở đâu:** `runner.ts:752`; `src/utils/retry.ts`.
- Request đã commit nhưng mất response (TypeError/5xx) → retry → `RECORD_NOT_UNIQUE` (400, không transient) → unit fail dù dữ liệu đã vào.
- **Fix:** trong lần retry, đọc lại key đang có và chỉ tạo phần còn thiếu.

### B18. Rollback: thử lại sau khi fail giữa chừng có thể xoá dòng gốc
- **Ở đâu:** `runner.ts:875` gọi `insertMissing`, hàm này đẩy key "hồi sinh" vào `run.createdKeys` (`:755-758`); chỉ reset ở `:897` khi thành công.
- Rollback fail giữa chừng → `createdKeys` giờ chứa cả dòng gốc của target → lần rollback sau **xoá** chúng trước rồi mới tạo lại (nếu lại fail thì mất).
- Phụ: rollback không có `withRetry`; status không chuyển về `running` nên UI ngừng poll, không thấy log tiến độ.
- **Fix:** rollback không dùng chung `createdKeys`; thêm retry; đặt status `rolling-back`.

### B19. Mirror delete thiếu chốt an toàn
- **Ở đâu:** `runner.ts:682-686`.
- `rowsByCollection.get(...) ?? []` → nếu thiếu entry thì `sourceKeys` rỗng → xoá **toàn bộ** target. Hiện được che bởi các check `stopRequested`/`failed` ở trên, nhưng chỉ cần một thay đổi nhỏ ở vòng lặp pass 1 là thành xoá sạch.
- **Fix:** thiếu entry thì `continue` (không xoá) — kiểm tra tường minh.

### B20. Constraint restore thất bại không được báo ở màn hình run
- `RelaxBanner` chỉ render trong `ConnectStep` (`connectStep.tsx:84`). Sau một run mà restore fail, user ở màn Apply chỉ thấy một dòng log đỏ; muốn sửa phải quay về Connect (và reset flow).
- **Fix:** hiển thị banner/nút "Repair" ngay trong `RunView` khi còn pending-relax cho target.

### B21. ✅ ĐÃ SỬA (phần chặn trước khi ghi) — Backup và token chỉ nằm trong bộ nhớ tab
- **Ở đâu:** `src/lib/store/runs.ts`.
- Reload/đóng tab/crash giữa run → mất backup → không rollback được, trong khi target có thể đang dở (stub + constraint nới). Giữ tới 20 backup toàn bảng trong RAM.
- **Quyết định (2026-10-09):** yêu cầu user tải file backup xuống trước khi ghi.
- **Đã làm:** status mới `awaiting-backup`. Sau stage backup, runner dừng (`holdForBackupDownload` trong `runner.ts`) cho tới khi user bấm Tải backup rồi Tiếp tục (`confirmBackup` trong `operations.ts`, panel trong `runView.tsx`). Bấm Huỷ lúc này thì run kết thúc `stopped`, chưa ghi gì. Áp dụng cho cả run schema.
- **Còn thiếu (follow-up):** file tải về hiện chỉ dùng được bằng tay — chưa có chức năng **rollback từ file** sau khi reload. Nên làm cùng lúc với B1/B2/B18. Giới hạn 20 backup trong RAM (O9) vẫn còn.

---

## P2 — Nhỏ / hardening

| ID | Ở đâu | Vấn đề | Hướng sửa |
|---|---|---|---|
| B22 | `runner.ts:95` | Run chỉ-schema vẫn tạo unit `files`, không bao giờ chạy → tiến độ dừng ở 2/3, hiện "untouched: files". | Chỉ tạo unit `files` khi có collection. |
| B23 | `runner.ts:813` | Bấm Stop khi mọi thứ đã xong vẫn ra `stopped`. | Chỉ `stopped` nếu còn unit chưa xong. |
| B24 | `detail.ts:340,363`; `sqlScript.ts:474` | Lọc `_in` với hàng trăm id trên URL GET → có thể quá dài, lỗi bị nuốt → mất nhãn / mất file. | Chia lô id. |
| B25 | `models/plan.ts:86-91`; `migrationWizard.tsx:210` | `destructiveChanges` đếm trùng collection vừa `delete` vừa có field destructive; đếm trên cả plan chứ không theo selection. | Dedupe + lọc theo `picked.schema`. |
| B26 | `data.ts:105`; `applyStep.tsx:66` | Code chết: nhánh `directus_files` (snapshot không chứa system collection); `counts.sequences`. | Xoá. |
| B27 | `probe.ts:34` | `isAdmin: true` hard-code. | Đọc từ `readMe` hoặc bỏ field. |
| B28 | `useApplyRun.ts:34-53`; `useSchemaRun.ts:25-45` | `start` lỗi thì dialog xác nhận vẫn mở, lỗi hiện phía sau; `useApplyRun.start` không xoá lỗi cũ. | Đóng dialog + set lỗi nhất quán. |
| B29 | `models/run.ts:85-93` | SQL reset sequence chỉ đúng cho Postgres; tên bảng trong literal không escape. | Theo vendor; dùng `quoteIdent`. |
| B30 | `schema.ts:358-374` | Thay đổi chỉ-meta trên object đã có (interface, options, note, translations…) không bao giờ được migrate và hiện là "unchanged". | Xác nhận có chủ đích; nếu có thì ghi rõ trên UI. |
| B31 | `detail.ts:164-173` | Record `conflict` (target mới hơn source) vẫn bị ghi đè, không cảnh báo ở Apply. | Đếm và cảnh báo trong dry-run/confirm. |
| B32 | `constraints.ts:80-110` | Nới/khôi phục hàng chục `updateField` (ALTER TABLE) song song. | Chạy tuần tự hoặc giới hạn 2–3. |
| B33 | `runner.ts:189`, `:309-333` | Stage files fail vẫn chạy tiếp data; copy **toàn bộ** file/folder của source dù chỉ chọn vài record (trong khi SQL script chỉ lấy file được tham chiếu). | Dừng khi files fail; chỉ copy file được tham chiếu. |
| B34 | `dryRun.ts` | Dry-run không mô phỏng mirror delete (FK từ dòng còn lại) và UNIQUE. | Bổ sung hoặc ghi rõ giới hạn. |
| B35 | `app/api/directus/[...path]/route.ts:10-13` | Không đặt `DIRECTUS_ALLOWED_HOSTS` thì là open proxy/SSRF (README đã ghi). Body request lỗi bị log ra console. | Bắt buộc allowlist khi `NODE_ENV=production`; cân nhắc bỏ log payload. |
| B36 | `recordList.tsx:44-56` | Checkbox header tính theo `visible` nhưng `onPick` gửi toàn bộ `records` (cả audit-only đang ẩn). | Sẽ tự hết khi làm B4; nếu không thì gửi `visible`. |

---

## Tối ưu hiệu năng

| ID | Ở đâu | Hiện tại | Đề xuất |
|---|---|---|---|
| O1 | `runner.ts` pass 2 | Ghi mọi dòng (B9). | Chỉ ghi dòng mới/đổi — giảm ghi mạnh nhất, cũng giảm RAM. |
| O2 | `runner.ts:455-477`, `:585`, `:748`, `:688` | Mỗi run đọc toàn bộ source 2 lần (expand picks + pass 1), key target 3 lần. | Đọc một lần, dùng lại trong run. |
| O3 | `paging.ts:31-47` | Phân trang `offset` + sort PK → càng về sau càng chậm với bảng lớn; thêm 1 request rỗng cuối mỗi bảng. | Keyset: `filter: { pk: { _gt: last } }`. |
| O4 | `data.ts:269-278` | Fingerprint source rồi mới target. | `Promise.all`. |
| O5 | `data.ts:34`, `sqlScript.ts:160`, `dryRun.ts:49` | Tuần tự từng collection. | Giới hạn song song 3–4, giữ log theo thứ tự. |
| O6 | `detail.ts:46-50`, `schema.ts:71-78`, `schemaSql.ts:323-335`, `sqlScript.ts:186-189,304-306` | `await` độc lập nối tiếp. | `Promise.all`. |
| O7 | `useRunActions.ts:20-29` + `operations.ts:121-126` | Poll 1s/lần và `structuredClone` cả run (log + `createdKeys` có thể hàng chục nghìn key) dù run nằm ngay trong tab. | Store có `subscribe` + `useSyncExternalStore`; bỏ poll và clone. |
| O8 | `runner.ts:393-395`, `:418-426` | Tạo folder/file mỗi cái một request. | Gộp lô (và chỉ file được tham chiếu — B33). |
| O9 | `runs.ts:20` | Giữ 20 backup toàn bảng trong RAM. | Giữ 1–2, hoặc đẩy ra đĩa (B21). |
| O10 | `operations.ts` | Import tĩnh toàn bộ `lib/directus` (~1.700 dòng runner + SQL) vào bundle bước Connect. | `await import()` trong handler Generate SQL / Apply. |
| O11 | `dataStep.tsx:123-127` | `includes` trong `filter` → O(n²) khi chọn tất cả. | Dùng `Set` (tự hết nếu làm B4). |
| O12 | `recordList.tsx:44-45` | Duyệt `visible` hai lần. | `allPicked = pickedCount === visible.length`. |

---

## React best practices (từ lượt review trước)

Không có vi phạm nghiêm trọng. React Compiler đang bật nên nhóm rule memo không áp dụng.

- `themeToggle.tsx:19-22` — toggle class + ghi localStorage đang ở effect (chạy cả lúc mount); chuyển vào `onClick`, thêm `try/catch` cho `setItem`.
- `useMigrationSelections.ts:8,10`, `useCollectionFilter.ts:13`, `useConnections.ts:15-16` — `useState(new Set())` / `useState(emptyConnection())` cấp phát mỗi render; dùng dạng hàm.
- `layout.tsx:20` — `THEME_SCRIPT` hard-code key thay vì `THEME_STORAGE_KEY`.
- `constants/storage.ts` — key localStorage chưa có version.
- `useMemo` thủ công ở `dataStep`, `schemaStep`, `applyStep`, hook filter, `translationContext` — thừa khi có compiler, xoá được.

---

## Tài liệu / hygiene

- **D1.** README lệch code: nói run "lives on the server (`src/providers/runStore.ts`)", `operations.ts` là "server actions", các thư mục `src/api/`, `src/providers/`, `src/routes/`, `public/locales/<locale>/common.json` — đều không còn đúng. Cũng nói gõ lại host khi ghi (B15) và chỉ bỏ `user_*` (B9).
- **D2.** Build cảnh báo: `The "middleware" file convention is deprecated. Please use "proxy" instead` → đổi `src/middleware.ts` thành `src/proxy.ts`.
- **D3.** `/[lang]/showcase` (675 dòng demo UI kit) được build vào production.
- **D4.** Test hiện chỉ phủ hàm thuần. Không có test nào cho `execute` / `copyData` / `rollbackRun` — đúng nơi tập trung B1–B11. Nên thêm test runner với client giả (fake `request`) cho: fail giữa pass, stop, restore fail, rollback có file.

---

## Thứ tự fix đề xuất

1. **Chốt kiến trúc B21** (backup ở đâu, runner ở client hay server) — ảnh hưởng cách sửa các mục dưới.
2. **Viết test runner với client giả (D4)** — để các fix sau có chỗ kiểm chứng.
3. **An toàn rollback/constraint:** B1, B2, B7, B8, B18, B19, B32.
4. **Trung thực về kết quả:** B3, B5, B11, B20, B22, B23.
5. **Đúng dữ liệu được ghi:** B9 (+O1, O2), B4 (+B36, O11), B16, B17.
6. **Luồng giữa các step:** B6, B10, B12, B15, B28.
7. **SQL script:** B13, B14, B29.
8. **Hiệu năng còn lại:** O3–O10.
9. **Dọn dẹp:** P2 còn lại, React nits, D1–D3.
