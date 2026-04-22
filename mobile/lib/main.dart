// lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'repositories/auth_repository.dart'; // 作成した認証リポジトリ

import 'screens/login_screen.dart'; 
import 'screens/admin_calendar_screen.dart';
import 'screens/home_screen.dart';
import 'screens/staff_calendar_screen.dart';
import 'screens/edit_account_screen.dart';
import 'screens/register_screen.dart';
import 'screens/shift_day_screen.dart';
import 'screens/shift_adjast_screen.dart';
import 'screens/staff_shop_register_screen.dart';
import 'screens/shop_register_screen.dart';
import 'screens/shop_screen.dart';
import 'screens/shop_users_screen.dart';
import 'screens/join_requests_screen.dart';
import 'screens/auto_adjust_settings_screen.dart';



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
      final isLoggingIn = state.matchedLocation == '/';
      final isRegistering = state.matchedLocation == '/register';

      if (authState.isLoading) {
        return null; // ローディング中は何もせず待機
      }

      final user = authState.hasValue ? authState.value : null;
      
      // 2. 認証状態によるリダイレクト
      if (user != null) {
        // ログイン画面／登録画面にいたら役割に応じて遷移先を変える
        if (isLoggingIn || isRegistering) {
          return (user.role == 'admin') ? '/admin_calendar' : '/staff_calendar';
        }
        return null;
      } else {
        // 未ログインならどのページでもログイン画面へ
        return (isLoggingIn || isRegistering) ? null : '/';
      }
    },

    routes: [
      GoRoute(
        path: '/',// ログイン画面
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/home',// ホーム画面(削除予定)
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/admin_calendar',// 管理者ホーム画面(カレンダー)
        builder: (context, state) => AdminCalendarScreen(),
      ),
      GoRoute(
        path: '/edit_account',// アカウント編集画面
        builder: (context, state) => const EditAccountScreen(),
      ),
      GoRoute(
        path: '/register',// 新規登録画面
        builder: (context, state) => RegisterScreen(),
      ),
      GoRoute(
        path: '/staff_calendar',// シフト一覧画面
        builder: (context, state) => StaffCalendarScreen(),
      ),
      GoRoute(
        path: '/shop/:shopId/shifts_day', // 日別シフト画面
        builder: (context, state) {
          final shopId = state.pathParameters['shopId']!;
          final dateStr = state.uri.queryParameters['date']!;
          return ShiftDayScreen(
            shopId: shopId,
            dateStr: dateStr,
          );
        },
      ),
      GoRoute(
        path: '/shop/:shopId/shift_adjust', // 日別シフト画面
        builder: (context, state) {
          final shopId = state.pathParameters['shopId']!;
          final dateStr = state.uri.queryParameters['date']!;
          return ShiftAdjastScreen(
            shopId: shopId,
            dateStr: dateStr,
          );
        },
      ),
      GoRoute(
        path: '/shop/:shopId', // 店舗詳細画面
        builder: (context, state) {
          final shopId = state.pathParameters['shopId']!;
          return ShopScreen(shopId: shopId);
        },
      ),
      GoRoute(
        path: '/shop/:shopId/users', //  店舗従業員一覧画面
        builder: (context, state) {
          final shopId = state.pathParameters['shopId']!;
          return ShopUsersScreen(shopId: shopId);
        },
      ),
      GoRoute(
        path: '/shop_register',// 店舗登録画面
        builder: (context, state) => ShopRegisterScreen(),
      ),
      GoRoute(
        path: '/staff_shop_register',// スタッフ用店舗登録画面
        builder: (context, state) => StaffShopRegisterScreen(),
      ),
      GoRoute(
        path: '/join_requests',// スタッフ用店舗登録画面
        builder: (context, state) => JoinRequestsScreen(),
      ),
      GoRoute(
        path: '/shop/:shopId/auto_adjust',
        builder: (context, state) {
          final shopId = state.pathParameters['shopId']!;
          return AutoAdjustSettingsScreen(shopId: shopId);
        },
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
      theme: ThemeData(
        primaryColor: const Color(0xFF001AAB), 
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color.fromARGB(255, 255, 255, 255), 
          primary: const Color(0xFF001AAB),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color.fromARGB(255, 255, 255, 255),
        ),
      ),
      routerConfig: router,
    );
  }
}
