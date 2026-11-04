# TeleShop: sửa lỗi trọng yếu và hoàn thiện có kiểm chứng

## Kết quả rà soát

Đã rà soát các nhóm cửa hàng, sản phẩm, đặt hàng, thanh toán, ví, đối soát Stars, quản trị, Telegram, giới thiệu và minigame. **61/61 kiểm tra hiện có đạt**, nhưng chưa bao phủ giao dịch tiền, thao tác đồng thời và lỗi ghi dữ liệu. Các phát hiện dưới đây được xác nhận từ mã hiện tại; chưa mô phỏng trên tiền thật.

Kiểm tra trực tiếp 8 trang chính với tài khoản được cấp cho phiên xem trước không thấy lỗi chạy; trang sản phẩm ở chiều rộng 390px không tràn ngang. Tài khoản này bị từ chối trang Admin và chưa có shop, nên chưa xác minh thao tác quản trị/shop. Mọi trang nội dung đã có thông tin tiêu đề và chia sẻ riêng.

### Lỗi cần sửa trước

| Ưu tiên | Vấn đề đã xác nhận | Tác động |
|---|---|---|
| 1 | Xác nhận thanh toán lấy tối đa số mã cần giao nhưng không kiểm tra đủ số lượng | Có thể thu đủ tiền nhưng giao thiếu mã khi nhiều người mua cùng lúc, kể cả mã tặng |
| 1 | Hoàn tiền cộng lại tồn kho nhưng mã đã giao vẫn ở trạng thái đã bán | Cửa hàng báo còn hàng trong khi không còn mã bán được |
| 1 | Nhận hàng chuyển tiền rồi mới đánh dấu mã đã nhận bằng thao tác riêng | Có thể chuyển tiền thành công nhưng báo lỗi nhận hàng, không sửa được bằng bấm lại |
| 1 | Mở/xử lý tranh chấp gồm nhiều thao tác riêng, bỏ qua một số kết quả lỗi | Có thể đóng tranh chấp dù chưa chuyển tiền, hoặc đóng băng đơn sau khi tiền đã giải ngân |
| 2 | Một số thao tác đơn, cài đặt và quản trị bỏ qua lỗi lưu | Báo lưu thành công hoặc gửi thông báo khi dữ liệu chưa cập nhật |
| 2 | Voucher giữ số tiền giảm cũ khi đổi số lượng | Tổng xem trước có thể khác hóa đơn thật; điều kiện chi tối thiểu có thể không còn hợp lệ |
| 2 | Số dư điểm chỉ cộng 500 dòng gần nhất | Người dùng nhiều giao dịch thấy sai điểm khả dụng |
| 3 | Danh sách sản phẩm/shop/quản trị/lịch sử Telegram có giới hạn mà không có trang tiếp | Không tìm được một phần danh mục hoặc lịch sử cũ |
| 3 | Trang chi tiết chiến dịch tải cả danh mục và truy vấn lặp theo từng giải | Chậm dần khi số chiến dịch và giải tăng; lỗi đọc bị che thành lịch sử trống |

## Thứ tự triển khai đề xuất

1. **Sửa giao mã và tồn kho.** Khóa dữ liệu cùng sản phẩm, chỉ giao khi đủ số lượng; ghi nhận rõ đơn đã thanh toán nhưng thiếu hàng để xử lý, không cho giải ngân như đơn giao đủ. Không đưa mã đã tiết lộ trở lại kho bán khi hoàn tiền.
   - Kiểm chứng: hai đơn cạnh tranh kho cuối, mua kèm quà, hoàn tiền mã cuối, nhận thanh toán lặp; đối chiếu mã giao/tồn/số đã bán và đơn cần xử lý.
2. **Sửa nhận hàng và tranh chấp.** Mỗi chuyển trạng thái cần một giao dịch nguyên tử, kiểm tra kết quả và cho phép thử lại an toàn; giữ nguyên cách tính tiền Stars thực nhận.
   - Kiểm chứng: bấm nhận hai lần chỉ ghi doanh thu một lần; lỗi đánh dấu mã không để tiền chuyển một nửa; tranh chấp cạnh tranh với nhận hàng/giải ngân chỉ có một kết quả hợp lệ. Xem lại mã, đơn, tranh chấp và ví trong ứng dụng.
3. **Loại bỏ báo thành công giả.** Kiểm tra lỗi ở thao tác lưu hóa đơn, trạng thái đơn, trả lời tranh chấp, shop, sản phẩm và cài đặt. Chỉ gửi thông báo sau khi lưu thành công; tách lỗi lịch sử khỏi trạng thái trống.
   - Kiểm chứng: giả lập lỗi lưu, xác nhận không báo thành công và không gửi thông báo sai; lưu rồi tải lại dữ liệu.
4. **Đồng bộ báo giá và điểm.** Dùng chung cách tính báo giá; kiểm tra lại voucher khi đổi số lượng, giới hạn số lượng đúng 100. Điểm khả dụng lấy từ toàn bộ sổ điểm, lịch sử được phân trang riêng.
   - Kiểm chứng: voucher phần trăm/giảm cố định/chi tối thiểu sau tăng giảm số lượng; hóa đơn khớp tổng xem trước; hơn 500 giao dịch điểm gồm cộng và trừ vẫn đúng.
5. **Hoàn thiện danh sách rồi tách phần tăng khách.** Thêm tải tiếp với thứ tự ổn định; gộp truy vấn lặp, tách danh mục/chi tiết/lịch sử chiến dịch. Chỉ loại bỏ phần thừa khi đã xác nhận không dùng; không viết lại ứng dụng.
   - Kiểm chứng: truy cập dữ liệu vượt các giới hạn cũ, không trùng/mất dòng; chi tiết chỉ tải chiến dịch đã chọn; kiểm tra tạo/duyệt/chơi/nhận quà bằng tài khoản phù hợp và kiểm tra điện thoại.

Mỗi bước giữ ứng dụng hoạt động, có kiểm tra lỗi hồi quy và kiểm tra trực tiếp trước khi sang bước tiếp theo.

## Bổ sung từ tài liệu chính thức

- **Hàng số trong Telegram phải dùng Stars:** đề xuất ràng buộc theo loại hàng và ngữ cảnh mua, không chỉ dựa vào nút bật/tắt chung. Crypto không thay thế Stars cho hàng số trong Telegram.
- **Hoàn Stars đúng phương thức:** thêm thao tác quản trị qua `refundStarPayment`, theo dõi kết quả/thử lại và đối soát; không hoàn Stars vào ví crypto như thể đã hoàn khoản thanh toán gốc.
- **Giám sát vận hành:** đưa đơn giao thiếu, gửi Telegram thất bại, thanh toán cần xử lý và Stars chờ đối soát vào danh sách quản trị có hành động xử lý.
- **Pool TON/rút tiền:** tiếp tục khóa nhận tiền và trả thưởng token đến khi có địa chỉ nhận thật, quyền chi trả, phí mạng và trạng thái giao dịch xác minh được. Ngân sách dự kiến không được gọi là tiền đã nạp. Xác nhận nhận quà là người dùng bấm, không phải Telegram chứng minh đã đọc.

Nguồn: [Telegram Stars](https://core.telegram.org/bots/payments-stars), [Telegram Bot API](https://core.telegram.org/bots/api#refundstarpayment), [Telegram Mini Apps](https://core.telegram.org/bots/webapps), [NOWPayments fees](https://nowpayments.io/help/about-nowpayments/about/what-are-your-fees), [NOWPayments API](https://nowpayments.io/help/what-is/what-is-api). Đây là khả năng trong tài liệu hiện có, không phải cam kết về quyền sử dụng của tài khoản TeleShop.

## Bảo mật: kết quả quét hiện có

Kết quả ngày 02/11/2026 chưa cập nhật với mã hiện tại, không có kết quả quét sâu gần đây. Bộ quét ghi nhận một lỗi đọc công khai cài đặt nền tảng, hai cảnh báo về đọc chính sách phí rút và người thắng, cùng một thông tin về biểu phí hoa hồng. Chưa kết luận những dữ liệu này phải công khai hay riêng tư; không tự thay đổi quyền truy cập chỉ từ cảnh báo.

**Anh chạy quét sâu trong tab Security** để có kết quả mới trước khi xử lý các phát hiện bảo mật. Chưa kết luận ứng dụng an toàn; không cập nhật gói phụ thuộc khi chưa được duyệt.

## Kỹ thuật và giới hạn kiểm chứng

- Điểm sửa chính: `drizzle/migrations/0002_product_code_pool.sql`, định nghĩa hoàn/giải ngân mới nhất ở `0008_stars_actual_settlement.sql`, `src/functions/orders.functions.ts`, `src/functions/admin.functions.ts`, `src/routes/_authenticated/checkout.tsx`, `src/lib/queries.ts`, `src/functions/growth.functions.ts`.
- Dùng migration bổ sung thay vì sửa lịch sử đã áp dụng; giữ server functions và các giao dịch SQL theo kiến trúc hiện có. Bổ sung kiểm tra giao dịch/lỗi đồng thời, không chỉ kiểm tra hàm tính giá.
- Không tự cấp quyền admin, nạp pool, chuyển tiền hoặc tạo đơn giả làm bằng chứng thanh toán thật.
- Đơn Stars thật, giới thiệu qua đăng nhập Telegram mới, giao quà Telegram và đối soát tiền thực nhận vẫn cần tài khoản phù hợp, thao tác trong Telegram và tiền người dùng chủ động thanh toán. Thiếu điều kiện nào sẽ ghi rõ, không báo đã kiểm chứng.

## Phạm vi duyệt

Duyệt kế hoạch này để triển khai lần lượt năm bước sửa lỗi và các bổ sung Stars/giám sát nêu trên. Tính năng nhận tiền pool TON và rút tự động chỉ triển khai khi các điều kiện ngoài ứng dụng đã được đáp ứng. Chưa có thay đổi mã ứng dụng trong lượt rà soát này.