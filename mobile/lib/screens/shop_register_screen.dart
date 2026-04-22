import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../repositories/auth_repository.dart';
import 'package:go_router/go_router.dart';
import '../widgets/app_scaffold.dart';

class ShopRegisterScreen extends ConsumerStatefulWidget {
  const ShopRegisterScreen({super.key});

  @override
  ConsumerState<ShopRegisterScreen> createState() => _ShopRegisterScreenState();
}

class _ShopRegisterScreenState extends ConsumerState<ShopRegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final nameController = TextEditingController();
  final locationController = TextEditingController();
  String message = '';
  bool isLoading = false;

  Future<void> handleRegister() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      isLoading = true;
      message = '店舗を登録中...';
    });

    try {
      // APIリクエスト（authProvider.notifier.shopRegisterを呼ぶ想定）
      final shopId = await ref.read(authProvider.notifier).shopRegister(
        nameController.text,
        locationController.text,
      );
      setState(() {
        message = '店舗登録成功！詳細ページに移動します...';
      });
      // 店舗詳細画面に遷移（shopIdが取得できた場合）
      if (shopId != null) {
        context.go('/shop/$shopId');
      }
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

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;
    final userRole = user?.role ?? 'staff';

    return AppScaffold(
      title: '新規店舗登録',
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
                  const Text('新規店舗登録', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  const Text('オーナーとして店舗情報を登録します。', style: TextStyle(fontSize: 14)),
                  const SizedBox(height: 16),
                  if (message.isNotEmpty)
                    Text(
                      message,
                      style: TextStyle(
                        color: message.contains('失敗') || message.contains('見つかりません')
                            ? Colors.red
                            : message.contains('登録中')
                                ? Colors.blue
                                : Colors.green,
                        fontSize: 14,
                      ),
                    ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: nameController,
                    decoration: const InputDecoration(labelText: '店舗名'),
                    validator: (v) => v == null || v.isEmpty ? '店舗名を入力してや' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: locationController,
                    decoration: const InputDecoration(labelText: '所在地 (任意)'),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: isLoading ? null : handleRegister,
                    child: isLoading
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text('店舗を登録'),
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