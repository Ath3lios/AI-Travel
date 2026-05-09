# Admin Layout Separation Design

## Mục tiêu

Tách khu vực admin ra khỏi shell của user trong cùng frontend hiện tại để admin trở thành một nhánh route và layout riêng biệt. Khu vực admin không còn phụ thuộc vào `Navbar` hoặc điều kiện ẩn/hiện dựa trên `pathname` trong shell chung.

## Phạm vi

- Giữ nguyên một ứng dụng frontend React hiện tại.
- Tách routing thành hai khu vực rõ ràng:
  - Public/User area
  - Admin area
- Giữ nguyên các trang và API hiện có.
- Giữ nguyên hành vi điều hướng sau đăng nhập:
  - admin vào `/admin`
  - user thường vào `/dashboard`
- Không tách admin thành một app frontend độc lập.
- Không chuyển toàn bộ các tab admin thành nhiều route con trong giai đoạn này.

## Hiện trạng

`frontend/src/App.jsx` đang chứa toàn bộ route của public, user và admin trong cùng một `Routes`. `Navbar` được render ở shell chung và chỉ bị ẩn khi `pathname` bắt đầu bằng `/admin`. Cách này làm admin về bản chất vẫn dùng chung khung điều hướng với user, chỉ khác ở một điều kiện hiển thị.

`frontend/src/components/Navbar.jsx` cũng đang chứa logic dành cho admin như `accountHomePath = '/admin'`, cho thấy component user shell đang biết quá nhiều về khu vực admin.

## Thiết kế đề xuất

### 1. Tách shell theo khu vực

Tạo hai layout độc lập:

- `UserLayout`
  - chịu trách nhiệm render `Navbar`
  - chứa các route public và user
- `AdminLayout`
  - chịu trách nhiệm render khung admin riêng
  - không dùng lại `Navbar` của user

`App.jsx` sẽ chỉ còn vai trò ghép provider, router và cây route cấp cao.

### 2. Tổ chức route

Tổ chức route theo hai nhánh:

- Nhánh user/public:
  - `/`
  - `/login`
  - `/register`
  - `/dashboard`
  - `/trips/:id`
- Nhánh admin:
  - `/admin/*`

Nhánh admin sẽ được bọc bởi `AdminRoute` để giữ điều kiện xác thực và phân quyền ở ranh giới khu vực admin, thay vì chỉ cho một route đơn lẻ.

### 3. Trách nhiệm của Navbar

`Navbar` chỉ còn phục vụ public/user area:

- không chứa logic xem user là admin để đổi “trang chủ tài khoản”
- không điều hướng về dashboard admin

Điều này làm ranh giới trách nhiệm rõ hơn: user shell quản lý điều hướng user, admin shell quản lý điều hướng admin.

### 4. Tổ chức mã nguồn tối thiểu

Ở bước đầu, giữ `frontend/src/pages/Admin.jsx` làm trang nội dung admin hiện tại để giới hạn phạm vi thay đổi. Việc tách tiếp thành `pages/admin` hoặc `features/admin` là bước tiếp theo có thể làm sau khi layout và route đã được cô lập.

Các file mới dự kiến:

- `frontend/src/layouts/UserLayout.jsx`
- `frontend/src/layouts/AdminLayout.jsx`

Các file sửa:

- `frontend/src/App.jsx`
- `frontend/src/components/Navbar.jsx`

## Luồng điều hướng

### User thường

- Truy cập public routes qua `UserLayout`
- Sau đăng nhập hoặc đăng ký, điều hướng đến `/dashboard`

### Admin

- Sau đăng nhập hoặc đăng ký, điều hướng đến `/admin`
- Khi vào `/admin/*`, user phải đi qua `AdminRoute`
- Nếu không đăng nhập, chuyển đến `/login`
- Nếu không có quyền admin, chuyển đến `/dashboard`

## Xử lý lỗi và hành vi biên

- Loading auth vẫn dùng `RouteLoading` như hiện tại để tránh nháy giao diện khi chưa biết trạng thái user.
- Admin route dùng wildcard `/admin/*` để tránh phải sửa lại cấu trúc khi sau này thêm các màn hình riêng như `/admin/users` hoặc `/admin/trips`.
- Nếu sau này xuất hiện nhu cầu deep-link vào từng tab admin, `AdminLayout` và nhánh `/admin/*` đã sẵn sàng để mở rộng mà không phải chạm lại shell user.

## Kiểm thử

### Kiểm thử hành vi

- Guest vào `/admin` bị chuyển sang `/login`
- User thường vào `/admin` bị chuyển sang `/dashboard`
- Admin vào `/admin` render giao diện admin mà không có `Navbar` của user
- User thường vào `/dashboard` vẫn thấy `Navbar`
- Đăng nhập admin điều hướng đến `/admin`
- Đăng nhập user điều hướng đến `/dashboard`

### Kiểm thử cấu trúc

- `App.jsx` không còn logic `isAdminRoute` để ẩn `Navbar`
- `Navbar.jsx` không còn phụ thuộc vào role admin để quyết định đường dẫn tài khoản

## Rủi ro và giới hạn

- `Admin.jsx` hiện vẫn là một file lớn, nên sau khi tách layout xong, việc bảo trì admin chỉ mới được cải thiện ở tầng route/layout chứ chưa cải thiện mạnh ở tầng module hóa.
- Nếu hiện tại có logic ngầm phụ thuộc vào việc admin và user ở cùng shell, các ca đó cần được xác minh lại qua test điều hướng.

## Kết quả mong đợi

Sau thay đổi, admin sẽ là một khu vực riêng biệt trong cùng ứng dụng frontend:

- có route boundary riêng
- có layout riêng
- không còn dùng chung shell điều hướng với user
- dễ mở rộng thành nhiều màn admin hơn trong các bước sau
