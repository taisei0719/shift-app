// lib/screens/login_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../repositories/auth_repository.dart'; // AuthNotifierを使うで！

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  // フォームで使うコントローラーや
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  // ログイン処理を実行する関数
  Future<void> _login() async {
    if (_formKey.currentState!.validate()) {
      final email = _emailController.text;
      final password = _passwordController.text;

      // 状態管理のAuthNotifierを取得して、loginメソッドを呼ぶ！
      try {
        await ref.read(authProvider.notifier).login(email, password);
        // ログイン成功後は、GoRouterのredirect機能が自動でHomeScreenに飛ばしてくれるさかい、ここでは何もしなくてええで！
      } catch (e) {
        // ログイン失敗時のエラーメッセージを表示
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))), // エラーメッセージを表示
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // AuthNotifierの状態を監視する（エラーハンドリングはここで見てもええし、リダイレクトはGoRouterに任せる）
    final authState = ref.watch(authProvider); 

    // ローディング中かどうか
    final isLoading = authState.isLoading;

    return Scaffold(
      appBar: AppBar(title: const Text('ログイン')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              // 1. メールアドレス入力フォーム
              TextFormField(
                controller: _emailController,
                decoration: const InputDecoration(
                  labelText: 'メールアドレス',
                  border: OutlineInputBorder(),
                ),
                keyboardType: TextInputType.emailAddress,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'メールアドレスを入力してください';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 20),

              // 2. パスワード入力フォーム
              TextFormField(
                controller: _passwordController,
                decoration: const InputDecoration(
                  labelText: 'パスワード',
                  border: OutlineInputBorder(),
                ),
                obscureText: true, // パスワードを非表示にする
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'パスワードを入力してください';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 30),

              // 3. ログインボタン
              ElevatedButton(
                onPressed: isLoading ? null : _login, // ローディング中はボタンを無効化
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 15),
                ),
                child: isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text(
                        'ログイン',
                        style: TextStyle(fontSize: 18),
                      ),
              ),
              const SizedBox(height: 10),

              // 4. 新規登録ボタン（ダミー）
              TextButton(
                onPressed: () {
                  // TODO: /register ルートに移動する処理を実装
                  ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('新規登録画面に移動')));
                },
                child: const Text('アカウントをお持ちでないですか？ 新規登録'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}