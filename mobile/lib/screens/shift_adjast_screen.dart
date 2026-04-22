import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../widgets/app_scaffold.dart';
import '../repositories/auth_repository.dart';

class ShiftAdjastScreen extends ConsumerStatefulWidget {
  final String shopId;
  final String dateStr;
  const ShiftAdjastScreen({super.key, required this.shopId, required this.dateStr});

  @override
  ConsumerState<ShiftAdjastScreen> createState() => _ShiftAdjastScreenState();
}

class _ShiftAdjastScreenState extends ConsumerState<ShiftAdjastScreen> {
  bool isLoading = true;
  bool isSubmitting = false;
  String? error;
  List<dynamic> staffShifts = [];

  // 編集用のローカルバッファ: userId -> list of confirmed entries ({start_time,end_time, maybe id})
  final Map<int, List<Map<String, dynamic>>> edits = {};

  @override
  void initState() {
    super.initState();
    _loadDay();
  }

  Future<void> _loadDay() async {
    setState(() {
      isLoading = true;
      error = null;
    });
    try {
      final auth = ref.read(authProvider.notifier);
      final list = await auth.fetchAdminShifts(widget.dateStr);
      setState(() {
        staffShifts = list;
        // 初期編集バッファを作る
        edits.clear();
        for (final s in staffShifts) {
          final uid = s['user_id'] as int? ?? -1;
          final confirmed = List<dynamic>.from(s['confirmed'] ?? []);
          edits[uid] = confirmed.map((c) => {
                'start_time': c['start_time'] ?? '',
                'end_time': c['end_time'] ?? '',
              }).toList();
        }
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        error = '日別シフト取得に失敗しました';
        isLoading = false;
      });
    }
  }

  void _addConfirmedRow(int userId, {String start = '09:00', String end = '17:00'}) {
    edits.putIfAbsent(userId, () => []);
    edits[userId]!.add({'start_time': start, 'end_time': end});
    setState(() {});
  }

  void _removeConfirmedRow(int userId, int idx) {
    edits[userId]?.removeAt(idx);
    setState(() {});
  }

  Future<void> _submitConfirmed() async {
    setState(() {
      isSubmitting = true;
      error = null;
    });
    try {
      final confirmedList = <Map<String, dynamic>>[];
      edits.forEach((userId, list) {
        for (final e in list) {
          final start = e['start_time'] ?? '';
          final end = e['end_time'] ?? '';
          if (start.trim().isEmpty || end.trim().isEmpty) continue;
          confirmedList.add({
            'user_id': userId,
            'start_time': start,
            'end_time': end,
            'shift_date': widget.dateStr,
          });
        }
      });

      if (confirmedList.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('確定するシフトがありません')));
        setState(() => isSubmitting = false);
        return;
      }

      final auth = ref.read(authProvider.notifier);
      await auth.confirmShifts(widget.dateStr, confirmedList);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('シフトを確定しました')));
      // 再読み込み or 戻る
      await _loadDay();
      setState(() => isSubmitting = false);
    } catch (e) {
      setState(() {
        error = '確定送信に失敗しました';
        isSubmitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;

    if (isLoading) {
      return AppScaffold(
        title: 'シフト調整 - ${widget.dateStr}',
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

    return AppScaffold(
      title: 'シフト調整 - ${widget.dateStr}',
      userRole: user?.role ?? 'admin',
      shopId: user?.shopId?.toString(),
      userName: user?.userName,
      shopName: user?.shopName,
      onLogout: () async {
          await ref.read(authProvider.notifier).logout();
          context.go('/');
      },
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              if (error != null) Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(error!, style: const TextStyle(color: Colors.red)),
              ),
              ...staffShifts.map((staff) {
                final uid = staff['user_id'] as int? ?? -1;
                final name = staff['name'] ?? '不明';
                final requests = List<dynamic>.from(staff['requests'] ?? []);
                final confirmedLocal = edits[uid] ?? [];

                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 8),
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
                            ElevatedButton(
                              onPressed: () => _addConfirmedRow(uid),
                              child: const Text('確定行を追加'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        // 希望の簡易表示（タップで確定行にコピー可能）
                        if (requests.isNotEmpty) ...[
                          const Text('提出された希望', style: TextStyle(fontSize: 12, color: Colors.black54)),
                          const SizedBox(height: 6),
                          ...requests.map((r) {
                            final rs = r['start_time'] ?? '';
                            final re = r['end_time'] ?? '';
                            return ListTile(
                              dense: true,
                              title: Text('$rs - $re'),
                              subtitle: Text(r['note'] ?? ''),
                              trailing: IconButton(
                                icon: const Icon(Icons.add),
                                onPressed: () {
                                  _addConfirmedRow(uid, start: rs ?? '09:00', end: re ?? '17:00');
                                },
                              ),
                            );
                          }).toList(),
                          const Divider(),
                        ],

                        // 編集可能な確定行リスト
                        const Text('確定（編集）', style: TextStyle(fontSize: 12, color: Colors.black54)),
                        const SizedBox(height: 6),
                        if ((confirmedLocal).isEmpty) const Text('未設定'),
                        ...List.generate(confirmedLocal.length, (i) {
                          final entry = confirmedLocal[i];
                          return Row(
                            children: [
                              Expanded(
                                child: TextFormField(
                                  initialValue: entry['start_time'],
                                  decoration: const InputDecoration(labelText: '開始 (HH:MM)'),
                                  onChanged: (v) => entry['start_time'] = v,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextFormField(
                                  initialValue: entry['end_time'],
                                  decoration: const InputDecoration(labelText: '終了 (HH:MM)'),
                                  onChanged: (v) => entry['end_time'] = v,
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline),
                                onPressed: () => _removeConfirmedRow(uid, i),
                              ),
                            ],
                          );
                        }),
                      ],
                    ),
                  ),
                );
              }).toList(),

              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: isSubmitting ? null : _submitConfirmed,
                      icon: const Icon(Icons.save),
                      label: Text(isSubmitting ? '送信中...' : '確定して保存'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: () => context.go('/admin_calendar'),
                    child: const Text('戻る'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}