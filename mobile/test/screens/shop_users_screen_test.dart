import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/repositories/auth_repository.dart';
import 'package:mobile/screens/shop_users_screen.dart';

// AuthNotifierのDio呼び出しを避けるため、必要なメソッドだけ差し替えたフェイク。
class _FakeAuthNotifier extends AuthNotifier {
  _FakeAuthNotifier({
    required this.initialUsers,
    this.role = 'admin',
    this.throwOnUpdate = false,
  });

  final List<Map<String, dynamic>> initialUsers;
  final String role;
  final bool throwOnUpdate;
  String? lastUpdatedPosition;

  @override
  Future<User?> build() async {
    return User(
      userName: 'テストユーザー',
      role: role,
      shopId: 1,
      shopName: 'テスト店舗',
      email: 'test@example.com',
    );
  }

  @override
  Future<Map<String, dynamic>> fetchShopUsers(String shopId) async {
    return {
      'shop': {'name': 'テスト店舗'},
      'users': initialUsers,
    };
  }

  @override
  Future<String?> updateUserPosition(String shopId, int userId, String? position) async {
    if (throwOnUpdate) {
      throw Exception('ポジションの更新に失敗しました');
    }
    lastUpdatedPosition = position;
    return position;
  }
}

Widget _wrap(AuthNotifier notifier, {String? shopId = '1'}) {
  return ProviderScope(
    overrides: [
      authProvider.overrideWith(() => notifier),
    ],
    child: MaterialApp(
      home: ShopUsersScreen(shopId: shopId),
    ),
  );
}

void main() {
  group('ShopUsersScreen', () {
    testWidgets('ポジション未設定のスタッフには「ポジション未設定」と表示される', (tester) async {
      final notifier = _FakeAuthNotifier(initialUsers: [
        {'user_id': 1, 'user_name': 'スタッフA', 'role': 'staff', 'is_owner': false, 'position': null},
      ]);

      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();

      expect(find.textContaining('ポジション未設定'), findsOneWidget);
    });

    testWidgets('ポジション設定済みのスタッフにはそのポジション名が表示される', (tester) async {
      final notifier = _FakeAuthNotifier(initialUsers: [
        {'user_id': 1, 'user_name': 'スタッフA', 'role': 'staff', 'is_owner': false, 'position': 'キッチン'},
      ]);

      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();

      expect(find.textContaining('キッチン'), findsOneWidget);
    });

    testWidgets('管理者以外には編集アイコンが表示されない', (tester) async {
      final notifier = _FakeAuthNotifier(
        role: 'staff',
        initialUsers: [
          {'user_id': 1, 'user_name': 'スタッフA', 'role': 'staff', 'is_owner': false, 'position': null},
        ],
      );

      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.edit), findsNothing);
    });

    testWidgets('管理者はダイアログからポジションを編集して保存できる', (tester) async {
      final notifier = _FakeAuthNotifier(initialUsers: [
        {'user_id': 1, 'user_name': 'スタッフA', 'role': 'staff', 'is_owner': false, 'position': null},
      ]);

      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.edit));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'キッチン');
      await tester.tap(find.text('保存'));
      await tester.pumpAndSettle();

      expect(notifier.lastUpdatedPosition, 'キッチン');
      expect(find.textContaining('キッチン'), findsOneWidget);
    });

    testWidgets('予約語"unspecified"は保存できずダイアログにエラーが表示される', (tester) async {
      final notifier = _FakeAuthNotifier(initialUsers: [
        {'user_id': 1, 'user_name': 'スタッフA', 'role': 'staff', 'is_owner': false, 'position': null},
      ]);

      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.edit));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'unspecified');
      await tester.tap(find.text('保存'));
      await tester.pumpAndSettle();

      expect(find.textContaining('予約語のため指定できません'), findsOneWidget);
      expect(notifier.lastUpdatedPosition, isNull);
    });

    testWidgets('更新失敗時はSnackBarでエラーメッセージを表示する', (tester) async {
      final notifier = _FakeAuthNotifier(
        throwOnUpdate: true,
        initialUsers: [
          {'user_id': 1, 'user_name': 'スタッフA', 'role': 'staff', 'is_owner': false, 'position': null},
        ],
      );

      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.edit));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'キッチン');
      await tester.tap(find.text('保存'));
      await tester.pumpAndSettle();

      expect(find.text('ポジションの更新に失敗しました'), findsOneWidget);
    });
  });
}
