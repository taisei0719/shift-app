// ...existing code...
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../repositories/auth_repository.dart';
import '../widgets/app_scaffold.dart';
import 'package:go_router/go_router.dart';

class ShiftDayScreen extends ConsumerStatefulWidget {
  final String shopId;
  final String dateStr;

  const ShiftDayScreen({
    super.key,
    required this.shopId,
    required this.dateStr,
  });

  @override
  ConsumerState<ShiftDayScreen> createState() => _ShiftDayScreenState();
}

class _ShiftDayScreenState extends ConsumerState<ShiftDayScreen> {
  bool isLoading = true;
  String? error;
  List<dynamic> confirmedShifts = [];
  List<dynamic> adminStaffShifts = []; // 管理者向け（スタッフごとのシフト）
  // シフト希望の一時入力リスト（スタッフが提出する用）
  List<Map<String, String>> requests = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      isLoading = true;
      error = null;
    });
    try {
      final user = ref.read(authProvider).value;
      final authRepo = ref.read(authProvider.notifier);

      if (user == null) {
        setState(() {
          error = '未ログインやで';
          isLoading = false;
        });
        return;
      }

      if (user.role == 'admin') {
        final list = await authRepo.fetchAdminShifts(widget.dateStr);
        setState(() {
          adminStaffShifts = list;
          isLoading = false;
        });
      } else {
        final list = await authRepo.fetchConfirmedShifts(widget.dateStr);
        setState(() {
          confirmedShifts = list;
          isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        error = e.toString();
        isLoading = false;
      });
    }
  }

  void _addRequestRow() {
    setState(() {
      requests.add({"start": "09:00", "end": "17:00"});
    });
  }

  void _removeRequestRow(int idx) {
    setState(() {
      requests.removeAt(idx);
    });
  }

  Future<void> _submitRequests() async {
    try {
      final repoNotifier = ref.read(authProvider.notifier);
      final authRepo = repoNotifier as dynamic;
      await authRepo.submitShiftRequests(widget.dateStr, requests);
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('シフト希望を提出したで！')));
      await _load(); // 再ロード
      setState(() => requests = []);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('提出失敗: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).value;

    if (isLoading) {
      return AppScaffold(
        title: '日別シフト',
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

    if (error != null) {
      return AppScaffold(
        title: '日別シフト',
        userRole: user?.role ?? 'staff',
        shopId: user?.shopId?.toString(),
        userName: user?.userName,
        shopName: user?.shopName,
        onLogout: () async {
          await ref.read(authProvider.notifier).logout();
          context.go('/');
        },
        body: Center(child: Text('エラー: $error')),
      );
    }

    // スタッフビュー：自分の確定シフト一覧 + 希望提出フォーム
    if (user?.role != 'admin') {
      return AppScaffold(
        title: '日別シフト - ${widget.dateStr}',
        userRole: user?.role ?? 'staff',
        shopId: user?.shopId?.toString(),
        userName: user?.userName,
        shopName: user?.shopName,
        onLogout: () async {
          await ref.read(authProvider.notifier).logout();
          context.go('/');
        },
        body: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${widget.dateStr} の確定シフト', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                if (confirmedShifts.isEmpty) const Text('確定シフトはありません'),
                ...confirmedShifts.map((s) => ListTile(
                      leading: const Icon(Icons.check_circle, color: Colors.green),
                      title: Text('${s['start_time']} - ${s['end_time']}'),
                      subtitle: Text('${s['note'] ?? ''}'),
                    )),
                const Divider(),
                const SizedBox(height: 8),
                const Text('シフト希望を提出する', style: TextStyle(fontSize: 16)),
                const SizedBox(height: 8),
                ...List.generate(requests.length, (i) {
                  return Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          initialValue: requests[i]['start'],
                          decoration: const InputDecoration(labelText: '開始 (HH:MM)'),
                          onChanged: (v) => requests[i]['start'] = v,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextFormField(
                          initialValue: requests[i]['end'],
                          decoration: const InputDecoration(labelText: '終了 (HH:MM)'),
                          onChanged: (v) => requests[i]['end'] = v,
                        ),
                      ),
                      IconButton(icon: const Icon(Icons.delete), onPressed: () => _removeRequestRow(i)),
                    ],
                  );
                }),
                const SizedBox(height: 8),
                Row(
                  children: [
                    ElevatedButton(onPressed: _addRequestRow, child: const Text('希望行を追加')),
                    const SizedBox(width: 12),
                    ElevatedButton(onPressed: requests.isEmpty ? null : _submitRequests, child: const Text('提出')),
                  ],
                )
              ],
            ),
          ),
        ),
      );
    }

    // 管理者ビュー：その日の全従業員シフト表示
    return AppScaffold(
      title: '日別シフト（管理者） - ${widget.dateStr}',
      userRole: user?.role ?? 'admin',
      shopId: user?.shopId?.toString(),
      userName: user?.userName,
      shopName: user?.shopName,
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${widget.dateStr} の店舗全体シフト', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              if (adminStaffShifts.isEmpty) const Text('この日のシフトはありません'),
              ...adminStaffShifts.map((staff) {
                final name = staff['name'] ?? '不明';
                final requests = List<dynamic>.from(staff['requests'] ?? []);
                final confirmed = List<dynamic>.from(staff['confirmed'] ?? []);
                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 8),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 6),
                        if (confirmed.isNotEmpty)
                          ...confirmed.map((c) => ListTile(
                                leading: const Icon(Icons.check, color: Colors.green),
                                title: Text('${c['start_time']} - ${c['end_time']}'),
                                subtitle: Text(c['note'] ?? ''),
                              )),
                        if (requests.isNotEmpty)
                          ...requests.map((r) => ListTile(
                                leading: const Icon(Icons.hourglass_top, color: Colors.orange),
                                title: Text('${r['start_time']} - ${r['end_time']}'),
                                subtitle: Text(r['note'] ?? ''),
                              )),
                        if (confirmed.isEmpty && requests.isEmpty) const Text('提出・確定なし'),
                      ],
                    ),
                  ),
                );
              })
            ],
          ),
        ),
      ),
    );
  }
}