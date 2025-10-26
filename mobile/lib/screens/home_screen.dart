// lib/screens/home_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../repositories/auth_repository.dart';
import '../widgets/app_scaffold.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  // ログアウト処理を実行する関数
  Future<void> _logout(WidgetRef ref) async {
    // 状態管理のAuthNotifierを取得して、logoutメソッドを呼ぶ！
    await ref.read(authProvider.notifier).logout();
    // ログアウト後は、GoRouterのredirect機能が自動でLoginScreenに飛ばしてくれるで！
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // 認証状態（ログインユーザー）を監視
    final authState = ref.watch(authProvider);

    // ユーザー情報
    final user = authState.value;
    final userName = user?.userName ?? 'ゲスト';

    return Scaffold(
      appBar: AppBar(
        title: const Text('シフト管理メイン'),
        actions: [
          // ログアウトボタン
          TextButton.icon(
            icon: const Icon(Icons.logout, color: Colors.white),
            label: const Text('ログアウト', style: TextStyle(color: Colors.white)),
            onPressed: () => _logout(ref),
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Text(
              'お帰りなさい、${userName}さん！',
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 20),
            const Text('JWT認証成功！ここからシフト一覧などを表示するで。'),
            // TODO: ここにシフト表示のウィジェットを追加
          ],
        ),
      ),
    );
  }
}