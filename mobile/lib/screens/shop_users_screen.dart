import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show MaxLengthEnforcement;
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

// ポジション関連の予約語（backendのUNSPECIFIED_POSITIONと一致させる）
const _unspecifiedPositionValue = 'unspecified';

class _ShopUsersScreenState extends ConsumerState<ShopUsersScreen> {
  bool isLoading = true;
  String? error;
  List<dynamic> users = [];
  Map<String, dynamic>? shopData;
  bool get _isAdmin => ref.read(authProvider).value?.role == 'admin';

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

  Future<void> _editPosition(Map<String, dynamic> userItem) async {
    final controller = TextEditingController(text: userItem['position'] ?? '');
    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) {
        String? dialogError;
        return StatefulBuilder(
          builder: (dialogContext, setDialogState) => AlertDialog(
            title: Text('${userItem['user_name']} のポジション'),
            content: TextField(
              controller: controller,
              decoration: InputDecoration(
                hintText: '例: kitchen（空欄で未設定）',
                errorText: dialogError,
              ),
              maxLength: 50,
              maxLengthEnforcement: MaxLengthEnforcement.none,
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('キャンセル'),
              ),
              ElevatedButton(
                onPressed: () {
                  final value = controller.text.trim();
                  if (value.length > 50) {
                    setDialogState(() {
                      dialogError = 'ポジション名は50文字以内で入力してください';
                    });
                    return;
                  }
                  if (value == _unspecifiedPositionValue) {
                    setDialogState(() {
                      dialogError = '"$_unspecifiedPositionValue" は予約語のため指定できません';
                    });
                    return;
                  }
                  Navigator.pop(dialogContext, value);
                },
                child: const Text('保存'),
              ),
            ],
          ),
        );
      },
    );

    if (result == null || !mounted) return;

    try {
      final newPosition = await ref.read(authProvider.notifier).updateUserPosition(
            widget.shopId!,
            userItem['user_id'] as int,
            result.isEmpty ? null : result,
          );
      if (!mounted) return;
      setState(() {
        userItem['position'] = newPosition;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
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
          final position = userItem['position'] as String?;
          return ListTile(
            leading: CircleAvatar(
              child: Text(userItem['user_name'].toString().substring(0, 1)),
              backgroundColor: userItem['is_owner'] ? Colors.indigo : Colors.grey,
            ),
            title: Text(userItem['user_name']),
            subtitle: Text(
              '${userItem['role'] == 'admin' ? 'オーナー' : 'スタッフ'}'
              '${position != null && position.isNotEmpty ? ' ・ $position' : ' ・ ポジション未設定'}',
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (userItem['is_owner'])
                  const Padding(
                    padding: EdgeInsets.only(right: 8),
                    child: Chip(label: Text('オーナー'), backgroundColor: Colors.yellow),
                  ),
                if (_isAdmin)
                  IconButton(
                    icon: const Icon(Icons.edit),
                    tooltip: 'ポジションを編集',
                    onPressed: () => _editPosition(userItem),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}