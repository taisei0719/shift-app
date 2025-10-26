// lib/repositories/auth_repository.dart
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../api/api_client.dart'; // さっき作ったファイルやで！

// -------------------- 1. ユーザーモデル --------------------
// Flaskから返ってくるユーザー情報を格納するクラス
class User {
  final String userName;
  final String role;
  final int shopId;
  final String shopName;

  User({
    required this.userName,
    required this.role,
    required this.shopId,
    required this.shopName,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      userName: json['user_name'],
      role: json['role'],
      shopId: json['shop_id'],
      shopName: json['shop_name'],
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
}

// -------------------- 5. RiverpodのProvider --------------------
// AuthNotifierをアプリ全体で使えるようにするProvider
final authProvider = AsyncNotifierProvider<AuthNotifier, User?>(() {
  return AuthNotifier();
});
