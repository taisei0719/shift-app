import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/repositories/auth_repository.dart';
import 'package:mobile/screens/login_screen.dart';

// AuthNotifierのDio呼び出しを避けるため、必要なメソッドだけ差し替えたフェイク。
class _FakeAuthNotifier extends AuthNotifier {
  _FakeAuthNotifier({this.throwOnLogin = false});

  final bool throwOnLogin;
  String? lastEmail;
  String? lastPassword;

  @override
  Future<User?> build() async => null;

  @override
  Future<void> login(String email, String password) async {
    lastEmail = email;
    lastPassword = password;
    if (throwOnLogin) {
      throw Exception('ログインに失敗しました');
    }
    state = AsyncData(User(
      userName: 'テストユーザー',
      role: 'staff',
      shopId: null,
      shopName: null,
      email: email,
    ));
  }
}

Widget _wrap(AuthNotifier notifier) {
  return ProviderScope(
    overrides: [
      authProvider.overrideWith(() => notifier),
    ],
    child: MaterialApp(home: const LoginScreen()),
  );
}

void main() {
  group('LoginScreen', () {
    testWidgets('メールアドレス・パスワード入力欄とログインボタンが表示される', (tester) async {
      await tester.pumpWidget(_wrap(_FakeAuthNotifier()));
      await tester.pumpAndSettle();

      expect(find.byType(TextFormField), findsNWidgets(2));
      expect(find.widgetWithText(ElevatedButton, 'ログイン'), findsOneWidget);
    });

    testWidgets('未入力で送信するとバリデーションエラーが表示される', (tester) async {
      final notifier = _FakeAuthNotifier();
      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(ElevatedButton, 'ログイン'));
      await tester.pumpAndSettle();

      expect(find.text('メールアドレスを入力してください'), findsOneWidget);
      expect(find.text('パスワードを入力してください'), findsOneWidget);
      expect(notifier.lastEmail, isNull);
    });

    testWidgets('メール・パスワードを入力してログインボタンを押すとloginが呼ばれる', (tester) async {
      final notifier = _FakeAuthNotifier();
      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField).first, 'test@example.com');
      await tester.enterText(find.byType(TextFormField).last, 'password123');
      await tester.tap(find.widgetWithText(ElevatedButton, 'ログイン'));
      await tester.pumpAndSettle();

      expect(notifier.lastEmail, 'test@example.com');
      expect(notifier.lastPassword, 'password123');
    });

    testWidgets('ログイン失敗時はSnackBarでエラーメッセージを表示する', (tester) async {
      final notifier = _FakeAuthNotifier(throwOnLogin: true);
      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField).first, 'test@example.com');
      await tester.enterText(find.byType(TextFormField).last, 'wrongpass');
      await tester.tap(find.widgetWithText(ElevatedButton, 'ログイン'));
      await tester.pumpAndSettle();

      expect(find.text('ログインに失敗しました'), findsOneWidget);
    });
  });
}
