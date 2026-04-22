import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../repositories/auth_repository.dart';
import 'package:go_router/go_router.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final nameController = TextEditingController();
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  String role = 'staff';
  String error = '';

  Future<void> handleRegister() async {
    if (!_formKey.currentState!.validate()) return;
    try {
      await ref.read(authProvider.notifier).register(
        nameController.text,
        emailController.text,
        passwordController.text,
        role,
      );
      // 登録成功したらホーム画面へ
      if (mounted) context.go('/home');
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e.toString().replaceAll('Exception:', '').trim();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('新規ユーザー登録')),
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
                  const Text('ユーザー登録', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  if (error.isNotEmpty)
                    Text(
                      error,
                      style: const TextStyle(color: Colors.red, fontSize: 14),
                    ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: nameController,
                    decoration: const InputDecoration(labelText: '名前'),
                    validator: (v) => v == null || v.isEmpty ? '名前を入力してや' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: emailController,
                    decoration: const InputDecoration(labelText: 'メールアドレス'),
                    keyboardType: TextInputType.emailAddress,
                    validator: (v) => v == null || v.isEmpty ? 'メールアドレスを入力してや' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: passwordController,
                    decoration: const InputDecoration(labelText: 'パスワード'),
                    obscureText: true,
                    validator: (v) => v == null || v.isEmpty ? 'パスワードを入力してや' : null,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: role,
                    decoration: const InputDecoration(labelText: '役割'),
                    items: const [
                      DropdownMenuItem(value: 'staff', child: Text('スタッフ')),
                      DropdownMenuItem(value: 'admin', child: Text('オーナー')),
                    ],
                    onChanged: (v) => setState(() => role = v ?? 'staff'),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: handleRegister,
                    child: const Text('新規ユーザー登録'),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => context.go('/'),
                    child: const Text('すでにアカウントを持ってる？ ログイン'),
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