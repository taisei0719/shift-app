import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/repositories/auth_repository.dart';
import 'package:mobile/widgets/app_scaffold.dart';

// AuthNotifierのDio呼び出しを避けるため、必要なメソッドだけ差し替えたフェイク。
class _FakeAuthNotifier extends AuthNotifier {
  _FakeAuthNotifier({required this.shops, this.throwOnSwitch = false})
      : activeShopId = shops.isNotEmpty ? shops.first['shop_id'] as int : null;

  final List<Map<String, dynamic>> shops;
  final bool throwOnSwitch;
  int? activeShopId;
  bool switchCalled = false;
  int? lastSwitchedShopId;

  @override
  Future<User?> build() async {
    final activeShop = shops.firstWhere(
      (s) => s['shop_id'] == activeShopId,
      orElse: () => const {'name': 'テスト店舗'},
    );
    return User(
      userName: 'テスト管理者',
      role: 'admin',
      shopId: activeShopId,
      shopName: activeShop['name'] as String?,
      email: 'admin@example.com',
    );
  }

  @override
  Future<List<Map<String, dynamic>>> fetchMyShops() async => shops;

  @override
  Future<void> switchActiveShop(int shopId) async {
    switchCalled = true;
    lastSwitchedShopId = shopId;
    if (throwOnSwitch) {
      throw Exception('店舗の切替に失敗しました');
    }
    activeShopId = shopId;
    state = await AsyncValue.guard(build);
  }
}

Widget _wrap(AuthNotifier notifier, {String initialLocation = '/shop/1/users'}) {
  final router = GoRouter(
    initialLocation: initialLocation,
    routes: [
      GoRoute(
        path: '/shop/:shopId/users',
        builder: (context, state) {
          final shopId = state.pathParameters['shopId']!;
          return AppScaffold(
            title: '従業員一覧',
            shopId: shopId,
            body: Text('shop-$shopId'),
          );
        },
      ),
    ],
  );

  return ProviderScope(
    overrides: [
      authProvider.overrideWith(() => notifier),
    ],
    child: MaterialApp.router(routerConfig: router),
  );
}

Future<void> _openDrawer(WidgetTester tester) async {
  await tester.tap(find.byIcon(Icons.menu));
  await tester.pumpAndSettle();
}

void main() {
  group('AppScaffold 店舗切替', () {
    testWidgets('2店舗以上所属している場合は切替ドロップダウンが表示される', (tester) async {
      final notifier = _FakeAuthNotifier(shops: [
        {'shop_id': 1, 'name': '店舗A', 'is_active': true},
        {'shop_id': 2, 'name': '店舗B', 'is_active': false},
      ]);

      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();
      await _openDrawer(tester);

      expect(find.byType(DropdownButton<int>), findsOneWidget);
    });

    testWidgets('1店舗のみの場合は切替ドロップダウンが表示されない', (tester) async {
      final notifier = _FakeAuthNotifier(shops: [
        {'shop_id': 1, 'name': '店舗A', 'is_active': true},
      ]);

      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();
      await _openDrawer(tester);

      expect(find.byType(DropdownButton<int>), findsNothing);
    });

    testWidgets('店舗を切り替えるとswitchActiveShopが呼ばれ、ルートも新しい店舗IDへ遷移する', (tester) async {
      final notifier = _FakeAuthNotifier(shops: [
        {'shop_id': 1, 'name': '店舗A', 'is_active': true},
        {'shop_id': 2, 'name': '店舗B', 'is_active': false},
      ]);

      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();
      expect(find.text('shop-1'), findsOneWidget);

      await _openDrawer(tester);
      await tester.tap(find.byType(DropdownButton<int>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('店舗B').last);
      await tester.pumpAndSettle();

      expect(notifier.switchCalled, isTrue);
      expect(notifier.lastSwitchedShopId, 2);
      expect(find.text('shop-2'), findsOneWidget);
    });

    testWidgets('切替に失敗した場合はドロワーにエラーメッセージを表示する', (tester) async {
      final notifier = _FakeAuthNotifier(
        throwOnSwitch: true,
        shops: [
          {'shop_id': 1, 'name': '店舗A', 'is_active': true},
          {'shop_id': 2, 'name': '店舗B', 'is_active': false},
        ],
      );

      await tester.pumpWidget(_wrap(notifier));
      await tester.pumpAndSettle();
      await _openDrawer(tester);

      await tester.tap(find.byType(DropdownButton<int>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('店舗B').last);
      await tester.pumpAndSettle();

      expect(find.text('店舗の切替に失敗しました'), findsOneWidget);
    });
  });
}
