import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../repositories/auth_repository.dart';
import '../widgets/app_scaffold.dart';
import 'package:go_router/go_router.dart';

class JoinRequestsScreen extends ConsumerStatefulWidget {
  const JoinRequestsScreen({super.key});

  @override
  ConsumerState<JoinRequestsScreen> createState() => _JoinRequestsScreenState();
}

class _JoinRequestsScreenState extends ConsumerState<JoinRequestsScreen> {
  bool loading = true;
  String? error;
  String? message;
  List<Map<String, dynamic>> requests = [];

  Future<void> fetchRequests() async {
    setState(() {
      loading = true;
      error = null;
      message = null;
    });
    try {
      final res = await ref.read(authProvider.notifier).fetchJoinRequests();
      setState(() {
        requests = res;
      });
    } catch (e) {
      setState(() {
        error = e.toString().replaceFirst('Exception: ', '').trim();
      });
    } finally {
      setState(() {
        loading = false;
      });
    }
  }

  Future<void> handleAction(int userId, String action) async {
    setState(() {
      message = action == 'approve' ? '承認処理中...' : '拒否処理中...';
      error = null;
    });
    try {
      final res = await ref.read(authProvider.notifier).handleJoinRequest(userId, action);
      setState(() {
        message = res;
      });
      await fetchRequests();
    } catch (e) {
      setState(() {
        error = e.toString().replaceFirst('Exception: ', '').trim();
        message = null;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    fetchRequests();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;
    final isAdmin = user?.role == 'admin';

    if (!isAdmin) {
      return AppScaffold(
        title: '参加リクエスト一覧',
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
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 8)],
            ),
            child: const Text('このページにアクセスする権限がありません。', style: TextStyle(color: Colors.red)),
          ),
        ),
      );
    }

    if (loading) {
      return AppScaffold(
        title: '参加リクエスト一覧',
        userRole: user?.role ?? 'admin',
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

    if (error != null) {
      return AppScaffold(
        title: '参加リクエスト一覧',
        userRole: user?.role ?? 'admin',
        shopId: user?.shopId?.toString(),
        userName: user?.userName,
        shopName: user?.shopName,
        onLogout: () async {
          await ref.read(authProvider.notifier).logout();
          context.go('/');
        },
        body: Center(
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 8)],
            ),
            child: Text(error!, style: const TextStyle(color: Colors.red)),
          ),
        ),
      );
    }

    return AppScaffold(
      title: 'スタッフ参加リクエスト一覧',
      userRole: user?.role ?? 'admin',
      shopId: user?.shopId?.toString(),
      userName: user?.userName,
      shopName: user?.shopName,
      onLogout: () async {
          await ref.read(authProvider.notifier).logout();
          context.go('/');
        },
      body: Center(
        child: Container(
          width: 400,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 8)],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('スタッフ参加リクエスト一覧', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              if (message != null)
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: message!.contains('成功') || message!.contains('承認') ? Colors.green[50]
                      : message!.contains('処理中') ? Colors.blue[50]
                      : Colors.red[50],
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    message!,
                    style: TextStyle(
                      color: message!.contains('成功') || message!.contains('承認') ? Colors.green
                        : message!.contains('処理中') ? Colors.blue
                        : Colors.red,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              const SizedBox(height: 8),
              requests.isEmpty
                  ? const Text('現在、新しい参加リクエストはありません。', style: TextStyle(color: Colors.grey))
                  : Expanded(
                      child: ListView.builder(
                        itemCount: requests.length,
                        itemBuilder: (context, idx) {
                          final req = requests[idx];
                          return Card(
                            margin: const EdgeInsets.symmetric(vertical: 6),
                            child: ListTile(
                              title: Text(req['name'] ?? ''),
                              subtitle: Text(req['email'] ?? ''),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  ElevatedButton(
                                    onPressed: message != null ? null : () => handleAction(req['user_id'], 'approve'),
                                    style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                                    child: const Text('承認'),
                                  ),
                                  const SizedBox(width: 8),
                                  ElevatedButton(
                                    onPressed: message != null ? null : () => handleAction(req['user_id'], 'reject'),
                                    style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                                    child: const Text('拒否'),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}