// lib/api/api_client.dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// -------------------- 1. Dio インスタンス (API通信クライアント) --------------------
// Dioをシングルトン（アプリ全体で一つだけ使う）として提供するクラスや。
class ApiClient {
  final Dio dio;
  final FlutterSecureStorage storage;
  
  // FlaskバックエンドのベースURLを設定しいや！
  static const String baseUrl = 'http://localhost:5000/api'; // ★ ここは自分の環境に合わせてな

  ApiClient()
      : dio = Dio(BaseOptions(baseUrl: baseUrl)),
        storage = const FlutterSecureStorage() {
    // Interceptor（通信の自動化機能）を追加するで！
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // -------------------- リクエスト送信前 --------------------
          // 2. Secure Storageからトークンを読み込む
          final token = await storage.read(key: 'jwt_token');

          // 3. トークンがあったら、Authorizationヘッダーに自動で付与する
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          // 4. エラー処理（ここでは未認証エラー(401)だけシンプルに処理するで）
          if (error.response?.statusCode == 401) {
            // トークンが無効な場合、セキュアストレージからトークンを削除して強制ログアウトの準備
            await storage.delete(key: 'jwt_token');
            // アプリ全体に未認証状態になったことを伝えるためにエラーを再スローする
            // riverpodのAuthNotifierがこれを受け取るんや。
            return handler.reject(error);
          }
          // その他のエラーはそのまま次のハンドラに渡す
          return handler.next(error);
        },
      ),
    );
  }
}

// -------------------- 5. RiverpodのProvider --------------------
// アプリ全体でこのクライアントを使えるようにする
final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());