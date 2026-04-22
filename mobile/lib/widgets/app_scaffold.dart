import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class AppScaffold extends StatelessWidget {
  final Widget body;
  final String title;
  final String userRole;
  final String? shopId;
  final VoidCallback? onLogout;
  final String? userName;
  final String? shopName;

  const AppScaffold({
    Key? key,
    required this.body,
    this.title = 'ホーム',
    this.userRole = 'staff',
    this.shopId,
    this.onLogout,
    this.userName,
    this.shopName,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
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
    ];

    final menuItems = userRole == 'admin' ? adminMenu : staffMenu;

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    userName ?? 'ユーザー名未設定',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.left,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    shopName != null && shopName!.isNotEmpty
                        ? '店舗: $shopName'
                        : '店舗未登録',
                    style: const TextStyle(fontSize: 16, color: Colors.grey),
                    textAlign: TextAlign.left,
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                children: menuItems,
              ),
            ),
            Align(
              alignment: Alignment.bottomCenter,
              child: ListTile(
                leading: Icon(Icons.logout, color: Colors.red),
                title: Text('ログアウト', style: TextStyle(color: Colors.red)),
                onTap: onLogout ?? () => context.go('/'),
              ),
            ),
          ],
        ),
      ),
      body: body,
      bottomNavigationBar: SizedBox(
        height: 40,
        child: Container(
          color: Theme.of(context).colorScheme.surface,
          child: IconButton(
            icon: Icon(Icons.home),
            onPressed: () => context.go(userRole == 'admin' ? '/admin_calendar' : '/staff_calendar'),
          ),
        ),
      ),
    );
  }
}