// lib/screens/home_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../repositories/auth_repository.dart';
import '../widgets/app_scaffold.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.value;

    // ローディング中はローディング表示
    if (authState.isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    // ユーザー情報がnullならログイン画面に戻す
    if (user == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.go('/');
      });
      return const SizedBox.shrink();
    }

    // 店舗未登録ユーザーの場合は案内を表示
    if (user.shopId == null) {
      return AppScaffold(
        title: 'ホーム',
        userRole: user.role,
        shopId: null,
        userName: user.userName,
        shopName: '',
        onLogout: () async {
          await ref.read(authProvider.notifier).logout();
          context.go('/');
        },
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('ようこそ、${user.userName}さん！', style: const TextStyle(fontSize: 24)),
              const SizedBox(height: 20),
              const Text('まだ店舗に参加してません。店舗登録 or 店舗参加リクエストを送ってや！'),
              ElevatedButton(
                onPressed: () => context.go('/shop_register'),
                child: const Text('店舗登録（オーナー用）'),
              ),
              ElevatedButton(
                onPressed: () => context.go('/staff_shop_register'),
                child: const Text('店舗参加リクエスト（スタッフ用）'),
              ),
            ],
          ),
        ),
      );
    }

    // 店舗登録済みユーザーの画面
    return AppScaffold(
      title: 'home',
      userRole: user.role,
      shopId: user.shopId.toString(),
      userName: user.userName,
      shopName: user.shopName,
      onLogout: () async {
        await ref.read(authProvider.notifier).logout();
        context.go('/');
      },
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Text(
              'お帰りなさい、${user.userName}さん！',
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 20),
            const Text('JWT認証成功！ここからシフト一覧などを表示。'),
            TextButton.icon(
              icon: const Icon(Icons.logout),
              label: const Text('ログアウト'),
              onPressed: () async {
                await ref.read(authProvider.notifier).logout();
                context.go('/');
              },
            ),
          ],
        ),
      ),
    );
  }
}