// lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'repositories/auth_repository.dart'; // 作成した認証リポジトリ

import 'screens/login_screen.dart'; 
import 'screens/home_screen.dart';


// -------------------- 1. ルーターの設定 --------------------
final _routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/',
    // ログイン状態が変わったときに画面を再評価する
    refreshListenable: ValueNotifier(authState.isLoading ? null : authState),
    
    // 認証状態の変更を監視し、画面遷移を制御する
    redirect: (BuildContext context, GoRouterState state) {
      // 認証画面かどうか
      final isLoggingIn = state.matchedLocation == '/login';

      if (authState.isLoading) {
        return null; // ローディング中は何もせず待機
      }
      
      // 2. 認証状態によるリダイレクト
      // ユーザー情報がある（ログイン済み）
      if (authState.hasValue && authState.value != null) {
        // ログイン画面にいたなら、メイン画面に移動
        return isLoggingIn ? '/' : null;
      } 
      // ユーザー情報がない（未ログイン）
      else {
        // メイン画面にいようとしたなら、ログイン画面に移動
        return isLoggingIn ? null : '/login';
      }
    },

    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
    ],
  );
});


// -------------------- 3. アプリの実行 --------------------
void main() {
  // アプリ全体をRiverpodでラップする
  runApp(const ProviderScope(child: MyApp()));
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(_routerProvider);
    final authState = ref.watch(authProvider);

    if (authState.isLoading) {
      // 4. アプリ起動時のセッションチェック中はローディング画面を表示する
      return const MaterialApp(
        home: Scaffold(
          body: Center(
            child: CircularProgressIndicator(),
          ),
        ),
      );
    }

    // 5. ルーターを使ってアプリ本体を表示
    return MaterialApp.router(
      title: 'Shift App',
      routerConfig: router,
    );
  }
}
