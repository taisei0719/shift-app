import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../repositories/auth_repository.dart';

class AppScaffold extends ConsumerStatefulWidget {
  final Widget body;
  final String title;
  final String userRole;
  final String? shopId;
  final VoidCallback? onLogout;
  final String? userName;
  final String? shopName;

  const AppScaffold({
    super.key,
    required this.body,
    this.title = 'ホーム',
    this.userRole = 'staff',
    this.shopId,
    this.onLogout,
    this.userName,
    this.shopName,
  });

  @override
  ConsumerState<AppScaffold> createState() => _AppScaffoldState();
}

class _AppScaffoldState extends ConsumerState<AppScaffold> {
  bool switching = false;
  String? switchError;

  Future<void> _handleSwitchShop(int newShopId) async {
    final currentShopId = ref.read(authProvider).value?.shopId;
    if (newShopId == currentShopId) return;

    setState(() {
      switching = true;
      switchError = null;
    });

    try {
      await ref.read(authProvider.notifier).switchActiveShop(newShopId);
      ref.invalidate(myShopsProvider);

      if (!mounted) return;
      // 店舗依存のルート（/shop/<shopId>/...）を表示中の場合、切替後の
      // 店舗IDへ遷移し直さないと古い店舗の情報が表示されたままになる
      final location = GoRouterState.of(context).uri.toString();
      final match = RegExp(r'^/shop/\d+(.*)$').firstMatch(location);
      if (match != null && context.mounted) {
        context.go('/shop/$newShopId${match.group(1)}');
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        switchError = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          switching = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final shopId = widget.shopId;
    final userRole = widget.userRole;
    final myShopsAsync = ref.watch(myShopsProvider);
    final currentShopId = ref.watch(authProvider).value?.shopId;

    // staff用メニュー
    final List<Widget> staffMenu = [
      ListTile(
        leading: Icon(Icons.home),
        title: Text('ホーム'),
        //onTap: () => context.go('/home'),
        onTap: () => context.go('/staff_calendar'),
      ),
      ListTile(
        leading: Icon(Icons.calendar_today),
        title: Text('店舗登録'),
        onTap: () => context.go('/staff_shop_register'),
      ),
      ListTile(
        leading: Icon(Icons.calendar_today),
        title: Text('アカウント'),
        onTap: () => context.go('/edit_account'),
      ),
      ListTile(
        leading: Icon(Icons.store),
        title: Text('店舗詳細'),
        onTap: () => context.go('/shop/$shopId'),
      ),
      ListTile(
        leading: Icon(Icons.group),
        title: Text('従業員一覧'),
        onTap: () => context.go('/shop/$shopId/users'),
      ),
    ];

    // admin用メニュー
    final List<Widget> adminMenu = [
      ListTile(
        leading: Icon(Icons.home),
        title: Text('ホーム'),
        onTap: () => context.go('/admin_calendar'),
      ),
      ListTile(
        leading: Icon(Icons.calendar_today),
        title: Text('店舗登録'),
        onTap: () => context.go('/shop_register'),
      ),
      ListTile(
        leading: Icon(Icons.person),
        title: Text('アカウント'),
        onTap: () => context.go('/edit_account'),
      ),
      ListTile(
        leading: Icon(Icons.store),
        title: Text('店舗詳細'),
        onTap: () => context.go('/shop/$shopId'),
      ),
      ListTile(
        leading: Icon(Icons.group),
        title: Text('従業員一覧'),
        onTap: () => context.go('/shop/$shopId/users'),
      ),
      ListTile(
        leading: Icon(Icons.request_page),
        title: Text('参加リクエスト'),
        onTap: () => context.go('/join_requests'),
      ),
      ListTile(
        leading: Icon(Icons.history),
        title: Text('棄却履歴'),
        onTap: () => context.go('/shop/$shopId/rejection_history'),
      ),
    ];

    final menuItems = userRole == 'admin' ? adminMenu : staffMenu;
    final myShops = myShopsAsync.value ?? [];

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        leading: Builder(
          builder: (context) => IconButton(
            icon: Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
      ),
      drawer: Drawer(
        child: Column(
          children: [
            DrawerHeader(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.userName ?? 'ユーザー名未設定',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.left,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      widget.shopName != null && widget.shopName!.isNotEmpty
                          ? '店舗: ${widget.shopName}'
                          : '店舗未登録',
                      style: const TextStyle(fontSize: 16, color: Colors.grey),
                      textAlign: TextAlign.left,
                    ),
                    if (switchError != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        switchError!,
                        style: const TextStyle(fontSize: 12, color: Colors.red),
                      ),
                    ],
                    if (myShops.length > 1) ...[
                      const SizedBox(height: 8),
                      const Text(
                        'アクティブ店舗を切替',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                      DropdownButton<int>(
                        isExpanded: true,
                        value: myShops.any((s) => s['shop_id'] == currentShopId)
                            ? currentShopId
                            : null,
                        items: myShops
                            .map(
                              (s) => DropdownMenuItem<int>(
                                value: s['shop_id'] as int,
                                child: Text(s['name'] as String? ?? ''),
                              ),
                            )
                            .toList(),
                        onChanged: switching
                            ? null
                            : (value) {
                                if (value == null) return;
                                _handleSwitchShop(value);
                              },
                      ),
                    ],
                  ],
                ),
              ),
            ),
            Expanded(child: ListView(children: menuItems)),
            Align(
              alignment: Alignment.bottomCenter,
              child: ListTile(
                leading: Icon(Icons.logout, color: Colors.red),
                title: Text('ログアウト', style: TextStyle(color: Colors.red)),
                onTap: widget.onLogout ?? () => context.go('/'),
              ),
            ),
          ],
        ),
      ),
      body: widget.body,
      bottomNavigationBar: SizedBox(
        height: 40,
        child: Container(
          color: Theme.of(context).colorScheme.surface,
          child: IconButton(
            icon: Icon(Icons.home),
            onPressed: () => context.go(
              userRole == 'admin' ? '/admin_calendar' : '/staff_calendar',
            ),
          ),
        ),
      ),
    );
  }
}
