// lib/repositories/auth_repository.dart
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../api/api_client.dart';

// -------------------- 1. ユーザーモデル --------------------
// Flaskから返ってくるユーザー情報を格納するクラス
class User {
  final String userName;
  final String role;
  final int? shopId;
  final String? shopName;
  final String email;

  User({
    required this.userName,
    required this.role,
    required this.shopId,
    required this.shopName,
    required this.email,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      userName: json['user_name'],
      role: json['role'],
      shopId: json['shop_id'],
      shopName: json['shop_name'],
      email: json['email'] ?? '',
    );
  }
}

// -------------------- 2. 認証状態を管理するクラス --------------------
// AsyncNotifierを使って、ユーザーの状態を非同期に管理する
class AuthNotifier extends AsyncNotifier<User?> {
  late final Dio _dio;
  late final FlutterSecureStorage _storage;

  @override
  Future<User?> build() async {
    _dio = ref.read(apiClientProvider).dio;
    _storage = ref.read(apiClientProvider).storage;

    // 最初にアプリが起動した時にトークンをチェックして、セッションを復元する
    return _checkSession();
  }

  // セキュアストレージからトークンを読み込み、/api/sessionを叩いてユーザー情報を取得する
  Future<User?> _checkSession() async {
    final token = await _storage.read(key: 'jwt_token');
    if (token == null) {
      return null; // トークンがない = 未ログイン
    }

    try {
      // /api/sessionを叩くときは、api_clientのInterceptorが自動でヘッダーにトークンを付けてくれる！
      final response = await _dio.get('/session'); 
      final userData = response.data['user'];

      if (userData != null) {
        return User.fromJson(userData);
      }
      return null;
    } on DioException catch (_) {
      // 401エラーなどでセッション取得に失敗した場合、トークンを削除して未ログインにする
      await _storage.delete(key: 'jwt_token');
      return null;
    } catch (e) {
    state = AsyncValue.error(e, StackTrace.current);
    return null;
    }
  }

  // -------------------- 3. ログイン処理 --------------------
  Future<void> login(String email, String password) async {
    state = const AsyncLoading(); // 状態をローディング中にする

    try {
      final response = await _dio.post(
        '/login',
        data: {
          'identifier': email,
          'password': password,
        },
      );

      // debug
      // print('ログインAPIレスポンス: ${response.data}');
      
      // 成功時: JSONボディからトークンとユーザー情報を取得する
      final token = response.data['access_token'] as String;
      final userData = response.data['user'];

      // 4. トークンをセキュアストレージに保存
      await _storage.write(key: 'jwt_token', value: token);
      
      // 5. 状態を更新（ログイン完了）
      state = AsyncData(User.fromJson(userData));

    } on DioException catch (e) {
      // ログイン失敗時
      state = AsyncError(e, StackTrace.current); 
      // 処理が終わったのでエラーをthrowしてUIに伝える
      throw Exception(e.response?.data['error'] ?? 'ログインに失敗しました'); 
    }
  }
  
  // -------------------- 4. ログアウト処理 --------------------
  Future<void> logout() async {
    await _storage.delete(key: 'jwt_token'); // トークンを削除
    // 状態をnull（未ログイン）に更新
    state = const AsyncData(null); 
  }

  // アカウント編集
  Future<void> editAccount(String name, String email, String password) async {
    try {
      final response = await _dio.post(
        '/account/edit',
        data: {
          'name': name,
          'email': email,
          'password': password,
        },
      );
      // 編集後のユーザー情報で状態更新
      final userData = response.data['user'];
      state = AsyncData(User.fromJson(userData));
    } on DioException catch (e) {
      throw Exception(e.response?.data['error'] ?? 'アカウント編集に失敗しました');
    }
  }

  // アカウント削除
  Future<void> deleteAccount() async {
    try {
      await _dio.post('/account/delete'); // Flask側のエンドポイントに合わせてな
      await _storage.delete(key: 'jwt_token');
      state = const AsyncData(null); // 未ログイン状態に
    } on DioException catch (e) {
      throw Exception(e.response?.data['error'] ?? 'アカウント削除に失敗しました');
    }
  }

  // 新規ユーザー登録
  Future<void> register(String name, String email, String password, String role) async {
    state = const AsyncLoading();

    try {
      final response = await _dio.post(
        '/register',
        data: {
          'name': name,
          'email': email,
          'password': password,
          'role': role,
        },
      );
      // 登録成功時はトークンとユーザー情報を受け取る
      final token = response.data['access_token'] as String?;
      final userData = response.data['user'];

      if (token == null || userData == null) {
        throw Exception('登録に失敗しました');
      }

      await _storage.write(key: 'jwt_token', value: token);
      state = AsyncData(User.fromJson(userData));
    } on DioException catch (e) {
      state = AsyncError(e, StackTrace.current);
      throw Exception(e.response?.data['error'] ?? '新規登録に失敗しました');
    }
  }

  // 店舗登録（adminのみ）
  Future<int?> shopRegister(String name, String location) async {
    try {
      final response = await _dio.post(
        '/shop_register',
        data: {
          'name': name,
          'location': location,
        },
      );
      // 登録成功時はshop_idを返す（APIのレスポンスに合わせてな）
      final shopId = response.data['shop_id'] as int?;
      return shopId;
    } on DioException catch (e) {
      throw Exception(e.response?.data['error'] ?? '店舗登録に失敗しました');
    }
  }

  // スタッフの店舗参加リクエスト送信
  Future<void> sendShopJoinRequest(String shopCode) async {
    try {
      final response = await _dio.post(
        '/join_shop/request',
        data: {
          'shop_code': shopCode,
        },
      );
      // 成功時は何も返さずOK、失敗時はエラーthrow
      if (response.data['status'] != 'ok') {
        throw Exception(response.data['message'] ?? 'リクエスト送信に失敗しました');
      }
    } on DioException catch (e) {
      throw Exception(e.response?.data['error'] ?? 'リクエスト送信に失敗しました');
    }
  }

  // 店舗詳細取得
  Future<Map<String, dynamic>?> fetchShopDetail(String shopId) async {
    try {
      final response = await _dio.get('/shop/$shopId');
      return Map<String, dynamic>.from(response.data);
    } on DioException catch (e) {
      throw Exception(e.response?.data['error'] ?? '店舗情報の取得に失敗しました');
    }
  }

  // 店舗情報更新（adminのみ）
  Future<void> updateShopDetail(String shopId, String name, String location) async {
    try {
      await _dio.post(
        '/shop/$shopId',
        data: {
          'name': name,
          'location': location,
        },
      );
      // 成功時は何も返さんでOK
    } on DioException catch (e) {
      throw Exception(e.response?.data['error'] ?? '店舗情報の更新に失敗しました');
    }
  }

  // 参加リクエスト一覧取得（管理者用）
  Future<List<Map<String, dynamic>>> fetchJoinRequests() async {
    try {
      final response = await _dio.get('/join_requests');
      final list = response.data['requests'] as List<dynamic>? ?? [];
      return list.map((e) => Map<String, dynamic>.from(e)).toList();
    } on DioException catch (e) {
      throw Exception(e.response?.data['error'] ?? '参加リクエスト一覧の取得に失敗しました');
    }
  }

  // 参加リクエスト承認・拒否（管理者用）
  Future<String> handleJoinRequest(int userId, String action) async {
    try {
      final response = await _dio.post(
        '/join_requests/$userId',
        data: {'action': action}, // action: 'approve' or 'reject'
      );
      return response.data['message'] ?? '処理が完了しました';
    } on DioException catch (e) {
      throw Exception(e.response?.data['error'] ?? '参加リクエストの処理に失敗しました');
    }
  }

  // 店舗の従業員一覧取得
  Future<Map<String, dynamic>> fetchShopUsers(String shopId) async {
  final response = await _dio.get('/shops/$shopId/users');
  return response.data;
  }

  // スタッフ用：自分のシフト一覧（月ごと）
  Future<Map<String, dynamic>> fetchUserShiftsByMonth(int year, int month) async {
    try {
      final response = await _dio.get('/shifts/month/$year/$month');
      return Map<String, dynamic>.from(response.data);
    } on DioException catch (e) {
      throw Exception(e.response?.data['error'] ?? 'シフト一覧の取得に失敗しました');
    }
  }

  // シフト希望提出
  Future<void> submitShiftRequests(String dateStr, List<Map<String, String>> requests) async {
    try {
      final payload = {
        "requests": requests.map((r) => {"date": dateStr, "start": r['start'] ?? "00:00", "end": r['end'] ?? "00:00"}).toList()
      };
      final resp = await _dio.post('/shifts/submit_request', data: payload);
      if (resp.statusCode == 200 || resp.statusCode == 201) {
        return;
      }
      throw Exception('提出失敗');
    } on DioException catch (e) {
      throw Exception(e.response?.data ?? e.message);
    }
  }

  Future<List<dynamic>> fetchConfirmedShifts(String dateStr) async {
    try {
      final resp = await _dio.get('/shifts/$dateStr'); // バックエンドの実装に合わせてパス調整してな
      return List<dynamic>.from(resp.data['confirmed_shifts'] ?? []);
    } on DioException catch (e) {
      throw Exception(e.response?.data ?? e.message);
    }
  }

  // 管理者向け：指定年月の店舗別シフト状況取得（/api/admin/shifts/status/<year>/<month>）
  Future<Map<String, String>> fetchAdminMonthlyStatus(int year, int month) async {
    try {
      final resp = await _dio.get('/admin/shifts/status/$year/$month');
      if (resp.statusCode == 200) {
        final list = resp.data['monthly_status'] as List<dynamic>? ?? [];
        final Map<String, String> result = {};
        for (final item in list) {
          final date = item['date'] as String?;
          final status = item['status'] as String?;
          if (date != null && status != null) result[date] = status;
        }
        return result;
      }
      return {};
    } on DioException catch (e) {
      throw Exception(e.response?.data ?? e.message);
    }
  }

  // 管理者向け：指定日の店舗全体シフト取得（/api/admin/shifts/<date>）
  Future<List<dynamic>> fetchAdminShifts(String dateStr) async {
    try {
      final resp = await _dio.get('/admin/shifts/$dateStr');
      if (resp.statusCode == 200) {
        return List<dynamic>.from(resp.data['staff_shifts'] ?? []);
      }
      return [];
    } on DioException catch (e) {
      throw Exception(e.response?.data ?? e.message);
    }
  }

  // 管理者向け：確定シフトの一括確定送信
  Future<void> confirmShifts(String dateStr, List<Map<String, dynamic>> confirmedShifts) async {
    try {
      final payload = {
        "confirmed_shifts": confirmedShifts.map((s) {
          // ensure shift_date exists on each entry
          return {
            "user_id": s['user_id'],
            "start_time": s['start_time'],
            "end_time": s['end_time'],
            "shift_date": s['shift_date'] ?? dateStr,
          };
        }).toList()
      };
      final resp = await _dio.post('/admin/shifts/confirm', data: payload);
      if (resp.statusCode == 200) {
        return;
      }
      throw Exception('確定送信に失敗しました');
    } on DioException catch (e) {
      throw Exception(e.response?.data ?? e.message);
    }
  }
  Future<Map<String, dynamic>> fetchAutoAdjustConfig(String shopId) async {
    try {
      final resp = await _dio.get('/shop/$shopId/auto_adjust/config');
      final cfg = resp.data['config'] as Map<String, dynamic>? ?? {};
      return Map<String, dynamic>.from(cfg);
    } on DioException catch (e) {
      throw Exception(e.response?.data ?? e.message);
    }
  }

  // 管理者用：自動調整設定保存
  Future<void> saveAutoAdjustConfig(String shopId, Map<String, dynamic> payload) async {
    try {
      final resp = await _dio.post('/shop/$shopId/auto_adjust/config', data: payload);
      if (resp.statusCode == 200 || resp.statusCode == 201) return;
      throw Exception('設定の保存に失敗しました: status=${resp.statusCode}');
    } on DioException catch (e) {
      throw Exception(e.response?.data ?? e.message);
    }
  }

  // 管理者用：自動調整実行（simulate/apply）
  Future<Map<String, dynamic>> runAutoAdjust(String shopId, String dateStr, {bool apply = false}) async {
    try {
      final resp = await _dio.post('/admin/shifts/auto_adjust/$dateStr', data: {'apply': apply});
      return Map<String, dynamic>.from(resp.data ?? {});
    } on DioException catch (e) {
      throw Exception(e.response?.data ?? e.message);
    }
  }
}

// -------------------- 5. RiverpodのProvider --------------------
// AuthNotifierをアプリ全体で使えるようにするProvider
final authProvider = AsyncNotifierProvider<AuthNotifier, User?>(() {
  return AuthNotifier();
});
