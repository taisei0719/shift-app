import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../repositories/auth_repository.dart';
import '../widgets/app_scaffold.dart';

class RejectionHistoryScreen extends ConsumerStatefulWidget {
  final String shopId;
  const RejectionHistoryScreen({super.key, required this.shopId});

  @override
  ConsumerState<RejectionHistoryScreen> createState() => _RejectionHistoryScreenState();
}

class _RejectionHistoryScreenState extends ConsumerState<RejectionHistoryScreen> {
  bool isLoading = true;
  String? error;
  List<Map<String, dynamic>> histories = [];

  @override
  void initState() {
    super.initState();
    _fetchHistories();
  }

  Future<void> _fetchHistories() async {
    setState(() {
      isLoading = true;
      error = null;
    });
    try {
      final result = await ref.read(authProvider.notifier).fetchRejectionHistory(widget.shopId);
      if (!mounted) return;
      setState(() {
        histories = result;
        isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        error = '棄却履歴の取得に失敗しました';
        isLoading = false;
      });
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<bool> _confirmReset(String message) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('リセットの確認'),
        content: Text('$message\nこの操作は元に戻せません。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('キャンセル'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            child: const Text('リセット'),
          ),
        ],
      ),
    );
    return ok ?? false;
  }

  Future<void> _resetAll() async {
    if (!await _confirmReset('全スタッフの棄却履歴をリセットします。')) return;
    try {
      final message = await ref.read(authProvider.notifier).resetRejectionHistory(widget.shopId);
      _showMessage(message);
      await _fetchHistories();
    } catch (e) {
      _showMessage(e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _resetUser(Map<String, dynamic> history) async {
    final userName = history['user_name'] as String? ?? 'スタッフ';
    if (!await _confirmReset('$userNameの棄却履歴をリセットします。')) return;
    try {
      final message = await ref
          .read(authProvider.notifier)
          .resetRejectionHistory(widget.shopId, userId: history['user_id'] as int);
      _showMessage(message);
      await _fetchHistories();
    } catch (e) {
      _showMessage(e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _updateResetModeForAll(String mode) async {
    try {
      final message = await ref.read(authProvider.notifier).updateResetMode(widget.shopId, mode);
      _showMessage(message);
      await _fetchHistories();
    } catch (e) {
      _showMessage(e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _updateResetModeForUser(Map<String, dynamic> history, String mode) async {
    try {
      final message = await ref
          .read(authProvider.notifier)
          .updateResetMode(widget.shopId, mode, userId: history['user_id'] as int);
      _showMessage(message);
      await _fetchHistories();
    } catch (e) {
      _showMessage(e.toString().replaceFirst('Exception: ', ''));
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;

    return AppScaffold(
      title: '棄却履歴',
      userRole: user?.role ?? 'staff',
      shopId: user?.shopId?.toString(),
      userName: user?.userName,
      shopName: user?.shopName,
      onLogout: () async {
        await ref.read(authProvider.notifier).logout();
        if (!context.mounted) return;
      },
      body: isLoading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? Center(child: Text(error!))
              : RefreshIndicator(
                  onRefresh: _fetchHistories,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('全体操作', style: TextStyle(fontWeight: FontWeight.bold)),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  ElevatedButton(
                                    onPressed: _resetAll,
                                    style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
                                    child: const Text('全員リセット'),
                                  ),
                                  OutlinedButton(
                                    onPressed: () => _updateResetModeForAll('manual'),
                                    child: const Text('全員を手動リセットにする'),
                                  ),
                                  OutlinedButton(
                                    onPressed: () => _updateResetModeForAll('monthly'),
                                    child: const Text('全員を毎月自動リセットにする'),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (histories.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 32),
                          child: Center(child: Text('まだ履歴がありません')),
                        )
                      else
                        ...histories.map((history) {
                          final totalRequests = history['total_requests'] as int? ?? 0;
                          final totalAccepted = history['total_accepted'] as int? ?? 0;
                          final totalRejected = history['total_rejected'] as int? ?? 0;
                          final rate = (history['rejection_rate'] as num?)?.toDouble() ?? 0.0;
                          final ratePercent = (rate * 100).round();
                          final resetMode = history['reset_mode'] as String? ?? 'manual';

                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          history['user_name'] as String? ?? '不明',
                                          style: const TextStyle(fontWeight: FontWeight.bold),
                                        ),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.restart_alt),
                                        tooltip: 'このスタッフの履歴をリセット',
                                        onPressed: () => _resetUser(history),
                                      ),
                                    ],
                                  ),
                                  Text(
                                    '棄却率 $ratePercent%（採用$totalAccepted/提出$totalRequests・棄却$totalRejected）',
                                    style: const TextStyle(color: Colors.grey),
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      const Text('リセット方式: '),
                                      DropdownButton<String>(
                                        value: resetMode == 'monthly' ? 'monthly' : 'manual',
                                        items: const [
                                          DropdownMenuItem(value: 'manual', child: Text('手動')),
                                          DropdownMenuItem(value: 'monthly', child: Text('毎月自動')),
                                        ],
                                        onChanged: (value) {
                                          if (value == null) return;
                                          _updateResetModeForUser(history, value);
                                        },
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        }),
                    ],
                  ),
                ),
    );
  }
}
