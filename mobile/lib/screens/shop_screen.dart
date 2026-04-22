import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../repositories/auth_repository.dart';
import 'package:go_router/go_router.dart';
import '../widgets/app_scaffold.dart';

class ShopScreen extends ConsumerStatefulWidget {
  final String shopId;
  const ShopScreen({super.key, required this.shopId});

  @override
  ConsumerState<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends ConsumerState<ShopScreen> {
  Map<String, dynamic>? shop;
  String message = '';
  bool isLoading = false;
  bool isEditing = false;
  late TextEditingController nameController;
  late TextEditingController locationController;

  @override
  void initState() {
    super.initState();
    if (widget.shopId != 'null' && widget.shopId.isNotEmpty) {// shopIdがnullやったらAPI叩かへん
      _fetchShop();
    }
  }

  Future<void> _fetchShop() async {
    setState(() {
      isLoading = true;
      message = '';
    });
    try {
      final shopData = await ref.read(authProvider.notifier).fetchShopDetail(widget.shopId);
      setState(() {
        shop = shopData;
        nameController = TextEditingController(text: shop?['name'] ?? '');
        locationController = TextEditingController(text: shop?['location'] ?? '');
      });
    } catch (e) {
      setState(() {
        shop = null;
        message = '店舗情報の取得に失敗しました';
      });
    } finally {
      setState(() {
        isLoading = false;
      });
    }
  }

  Future<void> _handleUpdate() async {
    if (shop == null) return;
    setState(() {
      isLoading = true;
      message = '';
    });
    try {
      await ref.read(authProvider.notifier).updateShopDetail(
        widget.shopId,
        nameController.text,
        locationController.text,
      );
      setState(() {
        message = '更新成功';
        shop!['name'] = nameController.text;
        shop!['location'] = locationController.text;
        isEditing = false;
      });
    } catch (e) {
      setState(() {
        message = e.toString().replaceFirst('Exception: ', '').trim();
      });
    } finally {
      setState(() {
        isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;
    final isAdmin = user?.role == 'admin';

    if (isLoading) {
      return AppScaffold(
        title: '店舗情報',
        userRole: user?.role ?? 'staff',
        shopId: user?.shopId.toString(),
        userName: user?.userName,
        shopName: user?.shopName,
        onLogout: () async {
          await ref.read(authProvider.notifier).logout();
          context.go('/');
        },
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    // 店舗情報未登録時
    if (shop == null) {
      final registerPath = isAdmin ? '/shop_register' : '/staff_shop_register';
      final registerLabel = isAdmin ? '店舗登録ページへ移動' : '店舗参加（コード入力）へ移動';
      return AppScaffold(
        title: '店舗情報',
        userRole: user?.role ?? 'staff',
        shopId: user?.shopId.toString(),
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

    // 店舗情報登録済みの場合
    return AppScaffold(
      title: '店舗情報確認・編集',
      userRole: user?.role ?? 'staff',
      shopId: user?.shopId.toString(),
      userName: user?.userName,
      shopName: user?.shopName,
      onLogout: () async {
        await ref.read(authProvider.notifier).logout();
        context.go('/');
      },
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
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('店舗情報', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                if (message.isNotEmpty)
                  Text(
                    message,
                    style: TextStyle(
                      color: message.contains('失敗') || message.contains('権限がない')
                          ? Colors.red
                          : Colors.green,
                      fontSize: 14,
                    ),
                  ),
                if (!isAdmin)
                  Container(
                    margin: const EdgeInsets.symmetric(vertical: 8),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.orange[50],
                      border: Border.all(color: Colors.orange),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      'スタッフアカウントのため、店舗情報の編集はできません。',
                      style: TextStyle(color: Colors.orange),
                    ),
                  ),
                Form(
                  child: Column(
                    children: [
                      // 店舗名
                      TextFormField(
                        controller: nameController,
                        decoration: const InputDecoration(labelText: '店舗名'),
                        readOnly: !isAdmin || !isEditing,
                      ),
                      const SizedBox(height: 12),
                      // 所在地
                      TextFormField(
                        controller: locationController,
                        decoration: const InputDecoration(labelText: '所在地'),
                        readOnly: !isAdmin || !isEditing,
                      ),
                      const SizedBox(height: 12),
                      // 店舗コード（常に読み取り専用）
                      TextFormField(
                        initialValue: shop?['shop_code'] ?? '',
                        decoration: const InputDecoration(labelText: '店舗コード'),
                        readOnly: true,
                      ),
                      const SizedBox(height: 8),
                      const Text('スタッフの参加に必要なコードです。', style: TextStyle(fontSize: 12, color: Colors.grey)),
                      const SizedBox(height: 16),
                      // 編集ボタン・更新ボタン（管理者のみ）
                      if (isAdmin && !isEditing)
                        ElevatedButton(
                          onPressed: () => setState(() => isEditing = true),
                          child: const Text('店舗情報を編集'),
                        ),
                      if (isAdmin && isEditing)
                        ElevatedButton(
                          onPressed: isLoading ? null : _handleUpdate,
                          child: isLoading
                              ? const CircularProgressIndicator(color: Colors.white)
                              : const Text('店舗情報を更新'),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                if (isAdmin) ...[
                  ElevatedButton(
                    onPressed: () => context.go('/shop/${widget.shopId}/auto_adjust'),
                    child: const Text('自動調整設定'),
                  ),
                  const SizedBox(height: 8),
                ],
                ElevatedButton(
                  onPressed: () => context.go('/admin'),
                  child: const Text('カレンダーに戻る'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}