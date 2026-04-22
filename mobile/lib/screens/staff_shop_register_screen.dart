import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../repositories/auth_repository.dart';
import '../widgets/app_scaffold.dart';

class StaffShopRegisterScreen extends ConsumerStatefulWidget {
  const StaffShopRegisterScreen({super.key});

  @override
  ConsumerState<StaffShopRegisterScreen> createState() => _StaffShopRegisterScreenState();
}

class _StaffShopRegisterScreenState extends ConsumerState<StaffShopRegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final shopCodeController = TextEditingController();
  String message = '';
  bool isLoading = false;

  Future<void> handleRequest() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      isLoading = true;
      message = 'リクエストを送信中...';
    });

    try {
      await ref.read(authProvider.notifier).sendShopJoinRequest(shopCodeController.text);
      setState(() {
        message = '参加リクエストを送信しました！';
      });
      // ユーザー情報のリフレッシュも必要ならここで
      // await ref.read(authProvider.notifier).refreshUser();
    } catch (e) {
      setState(() {
        message = e.toString().replaceFirst('Exception: ', '').trim();
      });
    } finally {
      setState(() {
        isLoading = false;
      });
    }
  }

  Color getMessageColor() {
    if (message.contains('失敗') || message.contains('リクエスト送信に失敗')) {
      return Colors.red;
    } else if (message.contains('送信中')) {
      return Colors.blue;
    } else {
      return Colors.green;
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;
    final userRole = user?.role ?? 'staff';

    return AppScaffold(
      title: '店舗への参加リクエスト',
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
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('店舗への参加リクエスト', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  const Text('オーナーの承認を得るために、店舗コードを入力してください。', style: TextStyle(fontSize: 14)),
                  const SizedBox(height: 16),
                  if (message.isNotEmpty)
                    Text(
                      message,
                      style: TextStyle(color: getMessageColor(), fontSize: 14),
                    ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: shopCodeController,
                    decoration: const InputDecoration(labelText: '店舗コード (6桁)'),
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    validator: (v) {
                      if (v == null || v.isEmpty) return '店舗コードを入力してや';
                      if (v.length != 6 || int.tryParse(v) == null) return '6桁の数字で入力してや';
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: isLoading ? null : handleRequest,
                    child: isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text('リクエストを送信'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}