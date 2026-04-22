import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../repositories/auth_repository.dart';
import '../widgets/app_scaffold.dart';

class EditAccountScreen extends ConsumerStatefulWidget {
  const EditAccountScreen({super.key});

  @override
  ConsumerState<EditAccountScreen> createState() => _EditAccountScreenState();
}

class _EditAccountScreenState extends ConsumerState<EditAccountScreen> {
  late TextEditingController nameController;
  late TextEditingController emailController;
  late TextEditingController passwordController;
  String message = '';
  bool isDeleting = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider).value;
    nameController = TextEditingController(text: user?.userName ?? '');
    emailController = TextEditingController(text: user?.email ?? '');
    passwordController = TextEditingController();
  }

  Future<void> handleUpdate() async {
    try {
      // ここはAPIに合わせて修正してな
      await ref.read(authProvider.notifier).editAccount(
        nameController.text,
        emailController.text,
        passwordController.text,
      );
      setState(() {
        message = 'アカウント情報を更新しました';
      });
    } catch (e) {
      setState(() {
        message = 'アカウント情報の更新に失敗しました';
      });
    }
  }

  Future<void> handleDelete() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('アカウント削除確認'),
        content: const Text('ほんまにアカウント削除する？この操作は元に戻せへんで！'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('キャンセル')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('削除')),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() {
      isDeleting = true;
      message = 'アカウントを削除中...';
    });

    try {
      await ref.read(authProvider.notifier).deleteAccount();
      setState(() {
        message = 'アカウントは正常に削除されました。';
      });
      // ログアウトしてログイン画面へ
      Navigator.of(context).pushReplacementNamed('/login');
    } catch (e) {
      setState(() {
        message = 'アカウントの削除に失敗しました';
        isDeleting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;
    final userRole = user?.role ?? 'staff';

    return AppScaffold(
      title: 'アカウント編集',
      userRole: userRole,
      shopId: user?.shopId.toString(),
      userName: user?.userName,
      shopName: user?.shopName,
      onLogout: () async {
        await ref.read(authProvider.notifier).logout();
        context.go('/');
      },
      body: Center(
        child: SingleChildScrollView(
          child: Container(
            width: 350,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 8)],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('アカウント情報の編集', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                if (message.isNotEmpty)
                  Text(
                    message,
                    style: TextStyle(
                      color: message.contains('失敗') ? Colors.red : Colors.green,
                      fontSize: 14,
                    ),
                  ),
                const SizedBox(height: 12),
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: '名前'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: emailController,
                  decoration: const InputDecoration(labelText: 'メール'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: passwordController,
                  decoration: const InputDecoration(labelText: '新しいパスワード（変更しない場合は空欄）'),
                  obscureText: true,
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: handleUpdate,
                  child: const Text('更新'),
                ),
                const Divider(height: 32),
                const Text('アカウント削除', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                  onPressed: isDeleting ? null : handleDelete,
                  child: const Text('アカウントを削除'),
                ),
                const SizedBox(height: 8),
                const Text('※ 削除すると、全てのシフトデータも失われます。',
                    style: TextStyle(color: Colors.red, fontSize: 12)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}