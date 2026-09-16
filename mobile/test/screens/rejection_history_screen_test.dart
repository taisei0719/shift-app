import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/repositories/auth_repository.dart';
import 'package:mobile/screens/rejection_history_screen.dart';

// AuthNotifierのDio呼び出しを避けるため、必要なメソッドだけ差し替えたフェイク。
class _FakeAuthNotifier extends AuthNotifier {
  _FakeAuthNotifier({required this.initialHistories});

  final List<Map<String, dynamic>> initialHistories;
  int fetchCallCount = 0;
  int? lastResetUserId;
  bool lastResetWasCalled = false;
  String? lastResetModeValue;
  int? lastResetModeUserId;

  @override
  Future<User?> build() async {
    return User(
      userName: 'テスト管理者',
      role: 'admin',
      shopId: 1,
      shopName: 'テスト店舗',
      email: 'admin@example.com',
    );
  }

  @override
  Future<List<Map<String, dynamic>>> fetchRejectionHistory(String shopId) async {
    fetchCallCount++;
    return initialHistories;
  }

  @override
  Future<String> resetRejectionHistory(String shopId, {int? userId}) async {
    lastResetWasCalled = true;
    lastResetUserId = userId;
    return 'リセットしました';
  }

  @override
  Future<String> updateResetMode(String shopId, String resetMode, {int? userId}) async {
    lastResetModeValue = resetMode;
    lastResetModeUserId = userId;
    return '更新しました';
  }
}

Widget _wrap(AuthNotifier notifier) {
  return ProviderScope(
    overrides: [
      authProvider.overrideWith(() => notifier),
    ],
    child: MaterialApp(
      home: const RejectionHistoryScreen(shopId: '1'),
    ),
  );
}

void main() {
  group('RejectionHistoryScreen', () {
    testWidgets('棄却履歴の一覧が表示される', (tester) async {
      final notifier = _FakeAuthNotifier(initialHistories: [
        {
          'user_id': 1,
          'user_name': 'スタッフA',
          'total_requests': 10,
          'total_accepted': 7,
          'total_rejected': 3,
          'rejection_rate': 0.3,
          'reset_mode': 'manual',
        },
      ]);

      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();

      expect(find.text('スタッフA'), findsOneWidget);
      expect(find.textContaining('30%'), findsOneWidget);
      expect(find.textContaining('採用7'), findsOneWidget);
    });

    testWidgets('履歴が無い場合は案内文が表示される', (tester) async {
      final notifier = _FakeAuthNotifier(initialHistories: []);

      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();

      expect(find.text('まだ履歴がありません'), findsOneWidget);
    });

    testWidgets('全員リセットは確認ダイアログでキャンセルすると実行されない', (tester) async {
      final notifier = _FakeAuthNotifier(initialHistories: []);

      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();

      await tester.tap(find.text('全員リセット'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('キャンセル'));
      await tester.pumpAndSettle();

      expect(notifier.lastResetWasCalled, isFalse);
    });

    testWidgets('全員リセットを確認すると全員分のリセットが呼ばれる', (tester) async {
      final notifier = _FakeAuthNotifier(initialHistories: [
        {
          'user_id': 1,
          'user_name': 'スタッフA',
          'total_requests': 10,
          'total_accepted': 7,
          'total_rejected': 3,
          'rejection_rate': 0.3,
          'reset_mode': 'manual',
        },
      ]);

      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();

      await tester.tap(find.text('全員リセット'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('リセット'));
      await tester.pumpAndSettle();

      expect(notifier.lastResetWasCalled, isTrue);
      expect(notifier.lastResetUserId, isNull);
      expect(notifier.fetchCallCount, greaterThanOrEqualTo(2));
    });

    testWidgets('個別リセットアイコンから特定スタッフのみリセットできる', (tester) async {
      final notifier = _FakeAuthNotifier(initialHistories: [
        {
          'user_id': 42,
          'user_name': 'スタッフB',
          'total_requests': 5,
          'total_accepted': 2,
          'total_rejected': 3,
          'rejection_rate': 0.6,
          'reset_mode': 'manual',
        },
      ]);

      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.restart_alt));
      await tester.pumpAndSettle();
      await tester.tap(find.text('リセット'));
      await tester.pumpAndSettle();

      expect(notifier.lastResetWasCalled, isTrue);
      expect(notifier.lastResetUserId, 42);
    });

    testWidgets('個別のリセット方式をドロップダウンから変更できる', (tester) async {
      final notifier = _FakeAuthNotifier(initialHistories: [
        {
          'user_id': 42,
          'user_name': 'スタッフB',
          'total_requests': 5,
          'total_accepted': 2,
          'total_rejected': 3,
          'rejection_rate': 0.6,
          'reset_mode': 'manual',
        },
      ]);

      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();

      await tester.tap(find.byType(DropdownButton<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('毎月自動').last);
      await tester.pumpAndSettle();

      expect(notifier.lastResetModeValue, 'monthly');
      expect(notifier.lastResetModeUserId, 42);
    });
  });
}
