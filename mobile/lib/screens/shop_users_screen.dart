import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../repositories/auth_repository.dart';
import 'package:go_router/go_router.dart';
import '../widgets/app_scaffold.dart';

class ShopUsersScreen extends ConsumerStatefulWidget {
  final String? shopId;
  const ShopUsersScreen({super.key, required this.shopId});

  @override
  ConsumerState<ShopUsersScreen> createState() => _ShopUsersScreenState();
}

class _ShopUsersScreenState extends ConsumerState<ShopUsersScreen> {
  bool isLoading = true;
  String? error;
  List<dynamic> users = [];
  Map<String, dynamic>? shopData;

  @override
  void initState() {
    super.initState();
    // 店舗未登録ならAPI叩かへん
    if (widget.shopId != null) {
      _fetchUsers();
    } else {
      setState(() {
        isLoading = false;
      });
    }
  }

  Future<void> _fetchUsers() async {
    try {
      final shopUsers = await ref.read(authProvider.notifier).fetchShopUsers(widget.shopId!);
      setState(() {
        shopData = shopUsers['shop'];
        users = shopUsers['users'];
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        error = '従業員データの取得に失敗しました';
        isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;

    // ローディング中
    if (isLoading) {
      return AppScaffold(
        title: '従業員一覧',
        userRole: user?.role ?? 'staff',
        shopId: user?.shopId?.toString(),
        userName: user?.userName,
        shopName: user?.shopName,
        onLogout: () async {
          await ref.read(authProvider.notifier).logout();
          context.go('/');
        },
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    // 店舗未登録なら案内
    if (widget.shopId == null) {
      final isAdmin = user?.role == 'admin';
      final registerPath = isAdmin ? '/shop_register' : '/staff_shop_register';
      final registerLabel = isAdmin ? '店舗登録ページへ移動' : '店舗参加（コード入力）へ移動';
      return AppScaffold(
        title: '従業員一覧',
        userRole: user?.role ?? 'staff',
        shopId: user?.shopId?.toString(),
        userName: user?.userName,
        shopName: user?.shopName,
        onLogout: () async {
          await ref.read(authProvider.notifier).logout();
          context.go('/');
        },
        body: Center(
          child: Container(
            width: 350,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 8)],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('店舗が登録されていません', style: TextStyle(fontSize: 20)),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => context.go(registerPath),
                  child: Text(registerLabel),
                ),
                const SizedBox(height: 8),
                ElevatedButton(
                  onPressed: () => context.go('/admin'),
                  child: const Text('カレンダーに戻る'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    // APIエラー
    if (error != null) {
      return AppScaffold(
        title: '従業員一覧',
        userRole: user?.role ?? 'staff',
        shopId: user?.shopId?.toString(),
        userName: user?.userName,
        shopName: user?.shopName,
        onLogout: () async {
          await ref.read(authProvider.notifier).logout();
          context.go('/');
        },
        body: Center(child: Text(error!)),
      );
    }

    // 従業員一覧
    return AppScaffold(
      title: '${shopData?['name'] ?? '店舗'}の従業員一覧',
      userRole: user?.role ?? 'staff',
      shopId: user?.shopId?.toString(),
      userName: user?.userName,
      shopName: user?.shopName,
      onLogout: () async {
        await ref.read(authProvider.notifier).logout();
        context.go('/');
      },
      body: ListView.builder(
        itemCount: users.length,
        itemBuilder: (context, idx) {
          final userItem = users[idx];
          return ListTile(
            leading: CircleAvatar(
              child: Text(userItem['user_name'].toString().substring(0, 1)),
              backgroundColor: userItem['is_owner'] ? Colors.indigo : Colors.grey,
            ),
            title: Text(userItem['user_name']),
            subtitle: Text(userItem['role'] == 'admin' ? 'オーナー' : 'スタッフ'),
            trailing: userItem['is_owner']
                ? const Chip(label: Text('オーナー'), backgroundColor: Colors.yellow)
                : null,
          );
        },
      ),
    );
  }
}